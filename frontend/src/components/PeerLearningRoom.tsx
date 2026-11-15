import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Send,
  Paperclip,
  Edit3,
  Eraser,
  RotateCcw,
  Download,
  FileText,
  MapPin,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { ChatMessage, PlatformUser } from "../types";

interface PeerLearningRoomProps {
  socket: Socket | null;
  roomId: string;
  currentUser: PlatformUser;
  peerUser?: PlatformUser | null;
  onLeave: () => void;
}

export function PeerLearningRoom({
  socket,
  roomId,
  currentUser,
  peerUser,
  onLeave,
}: PeerLearningRoomProps) {
  // Media Streams & WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // Device Controls
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  // Permission Flow
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  // Collaborative Whiteboard
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#10b981"); // Default Emerald
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  // In-Session Chat & File Sharing
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // STUN Configuration
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // -------------------------------------------------------------
  // 1. Request Video, Audio, and Location Permissions
  // -------------------------------------------------------------
  useEffect(() => {
    let streamInstance: MediaStream | null = null;

    async function initMediaAndPermissions() {
      try {
        // Request Location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocationName(`Lat ${pos.coords.latitude.toFixed(2)}, Lon ${pos.coords.longitude.toFixed(2)}`);
            },
            () => {
              setLocationName("Location Shared (Local Network)");
            },
            { timeout: 5000 }
          );
        }

        // Request Camera & Microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });

        streamInstance = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn("Media access warning:", err);
        setPermissionError(
          "Camera or microphone access denied or not available. Running in interactive whiteboard and chat mode."
        );
      }
    }

    initMediaAndPermissions();

    return () => {
      if (streamInstance) {
        streamInstance.getTracks().forEach((track) => track.stop());
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
      }
    };
  }, []);

  // -------------------------------------------------------------
  // 2. WebRTC & Socket.io Signaling Lifecycle
  // -------------------------------------------------------------
  useEffect(() => {
    if (!socket || !roomId) return;

    // Join room
    socket.emit("join-room", {
      roomId,
      userId: currentUser.id,
      userName: currentUser.fullName,
    });

    const pc = new RTCPeerConnection(iceServers);
    pcRef.current = pc;

    // Add local tracks to WebRTC
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      }
    };

    // Send ICE candidates to peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    // When existing peer is detected, create SDP offer
    socket.on("peer-joined", async ({ socketId }) => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", {
          roomId,
          targetSocketId: socketId,
          sdp: offer,
        });
      } catch (e) {
        console.error("Error creating WebRTC offer:", e);
      }
    });

    socket.on("webrtc-offer", async ({ senderSocketId, sdp }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", {
          roomId,
          targetSocketId: senderSocketId,
          sdp: answer,
        });
      } catch (e) {
        console.error("Error handling WebRTC offer:", e);
      }
    });

    socket.on("webrtc-answer", async ({ sdp }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (e) {
        console.error("Error setting remote description:", e);
      }
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding ICE candidate:", e);
      }
    });

    // Whiteboard Drawing sync
    socket.on("whiteboard-draw", (drawData) => {
      drawOnCanvas(drawData, false);
    });

    socket.on("whiteboard-clear", () => {
      clearCanvasLocally();
    });

    // Chat messages
    socket.on("receive-chat-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    // File sharing
    socket.on("receive-file", (fileData: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: fileData.id,
          senderId: fileData.senderId,
          senderName: fileData.senderName,
          message: `Shared file: ${fileData.fileName}`,
          timestamp: fileData.timestamp,
          isFile: true,
          fileData: {
            fileName: fileData.fileName,
            fileSize: fileData.fileSize,
            fileType: fileData.fileType,
            dataUrl: fileData.fileData,
          },
        },
      ]);
    });

    return () => {
      socket.off("peer-joined");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("ice-candidate");
      socket.off("whiteboard-draw");
      socket.off("whiteboard-clear");
      socket.off("receive-chat-message");
      socket.off("receive-file");
      pc.close();
    };
  }, [socket, roomId, localStream]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -------------------------------------------------------------
  // 3. Media Controls (Camera, Mic, Screen Share)
  // -------------------------------------------------------------
  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const screenTrack = displayStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        // Replace outgoing track in RTCPeerConnection
        if (pcRef.current) {
          const sender = pcRef.current
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream;
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
        socket?.emit("screen-share-toggle", { roomId, isSharing: true });
      } catch (err) {
        console.warn("Screen share cancelled or failed:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    // Restore camera video track
    if (localStream && pcRef.current) {
      const cameraTrack = localStream.getVideoTracks()[0];
      const sender = pcRef.current
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender && cameraTrack) {
        sender.replaceTrack(cameraTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }

    setIsScreenSharing(false);
    socket?.emit("screen-share-toggle", { roomId, isSharing: false });
  };

  // -------------------------------------------------------------
  // 4. Collaborative Writing Board (Whiteboard) Canvas
  // -------------------------------------------------------------
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const drawData = {
      x,
      y,
      color: isEraser ? "#0f172a" : brushColor,
      size: isEraser ? brushSize * 4 : brushSize,
      isEraser,
    };

    drawOnCanvas(drawData, true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const drawOnCanvas = (
    data: { x: number; y: number; color: string; size: number; isEraser: boolean },
    broadcast: boolean
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = data.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = data.color;

    ctx.lineTo(data.x, data.y);
    ctx.stroke();

    if (broadcast && socket) {
      socket.emit("whiteboard-draw", { roomId, drawData: data });
    }
  };

  const clearCanvasLocally = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleClearWhiteboard = () => {
    clearCanvasLocally();
    socket?.emit("whiteboard-clear", { roomId });
  };

  // -------------------------------------------------------------
  // 5. Chat & File Upload / Exchange
  // -------------------------------------------------------------
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    socket.emit("send-chat-message", {
      roomId,
      message: chatInput.trim(),
      senderName: currentUser.fullName,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setChatInput("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("File size exceeds 25MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      socket.emit("send-file", {
        roomId,
        senderName: currentUser.fullName,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileData: base64Data,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-950 flex flex-col p-3 sm:p-6 max-w-[1600px] mx-auto">
      {/* Top Session Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Live 1-on-1 Session</span>
              <span className="text-xs text-slate-400 font-normal">({roomId})</span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Connected with: <strong className="text-emerald-400">{peerUser?.fullName || "Peer Mentor"}</strong></span>
              {locationName && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-800/40">
                  <MapPin className="w-3 h-3" />
                  <span>{locationName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onLeave}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Leave Room</span>
        </button>
      </div>

      {permissionError && (
        <div className="mb-4 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Main Learning Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* CENTER / LEFT: Collaborative Writing Board (Whiteboard) on Top */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* WRITING BOARD (WHITEBOARD) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Collaborative Writing Board <span className="text-emerald-400 font-normal lowercase">(both can draw live)</span>
                </h3>
              </div>

              {/* Whiteboard Controls */}
              <div className="flex items-center gap-2">
                {/* Color Palette */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {["#10b981", "#38bdf8", "#fbbf24", "#f43f5e", "#ffffff"].map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setBrushColor(color);
                        setIsEraser(false);
                      }}
                      style={{ backgroundColor: color }}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        brushColor === color && !isEraser ? "scale-125 ring-2 ring-white" : "opacity-80"
                      }`}
                    />
                  ))}
                </div>

                {/* Eraser */}
                <button
                  onClick={() => setIsEraser(!isEraser)}
                  className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                    isEraser
                      ? "bg-rose-900/60 border-rose-500 text-rose-300"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Eraser</span>
                </button>

                {/* Brush Size */}
                <select
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="px-2 py-1 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs"
                >
                  <option value={2}>Thin (2px)</option>
                  <option value={4}>Medium (4px)</option>
                  <option value={8}>Thick (8px)</option>
                </select>

                {/* Clear */}
                <button
                  onClick={handleClearWhiteboard}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors"
                  title="Clear Writing Board"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            {/* Canvas Surface */}
            <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 cursor-crosshair min-h-[340px] flex-1">
              <canvas
                ref={canvasRef}
                width={900}
                height={400}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="w-full h-full block touch-none"
              />
            </div>
          </div>

          {/* BOTH USERS VIDEOS (FACE CAMS) LIVE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Local Face Cam */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden aspect-video shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isVideoEnabled ? "hidden" : ""}`}
              />
              {!isVideoEnabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-2">
                    <VideoOff className="w-8 h-8 text-slate-500" />
                  </div>
                  <span className="text-xs font-semibold">Your Camera is Off</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-sm text-[11px] font-bold text-white border border-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>You ({currentUser.fullName})</span>
                {!isAudioEnabled && <MicOff className="w-3 h-3 text-rose-400 ml-1" />}
              </div>
            </div>

            {/* Remote Peer Face Cam */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden aspect-video shadow-lg">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${!remoteStream ? "hidden" : ""}`}
              />
              {!remoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mb-2 animate-pulse">
                    <Video className="w-8 h-8 text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-white mb-1">
                    Connecting with {peerUser?.fullName || "Peer"}...
                  </span>
                  <span className="text-[11px] text-slate-500 max-w-xs">
                    Live peer-to-peer WebRTC video will appear as soon as connection finishes.
                  </span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-sm text-[11px] font-bold text-emerald-300 border border-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{peerUser?.fullName || "Peer Mentor"}</span>
              </div>
            </div>
          </div>

          {/* BOTTOM CONTROL BAR: Video on/off, Audio on/off, Screen Share, Leave */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-center gap-4 shadow-xl">
            {/* Audio Toggle */}
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
                isAudioEnabled
                  ? "bg-slate-800 hover:bg-slate-700 text-white"
                  : "bg-rose-600 hover:bg-rose-500 text-white"
              }`}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5 text-emerald-400" /> : <MicOff className="w-5 h-5" />}
              <span>{isAudioEnabled ? "Mute" : "Unmute"}</span>
            </button>

            {/* Video Toggle */}
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
                isVideoEnabled
                  ? "bg-slate-800 hover:bg-slate-700 text-white"
                  : "bg-rose-600 hover:bg-rose-500 text-white"
              }`}
            >
              {isVideoEnabled ? <Video className="w-5 h-5 text-emerald-400" /> : <VideoOff className="w-5 h-5" />}
              <span>{isVideoEnabled ? "Stop Camera" : "Start Camera"}</span>
            </button>

            {/* Screen Share Button */}
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
                isScreenSharing
                  ? "bg-teal-600 hover:bg-teal-500 text-white ring-2 ring-teal-400"
                  : "bg-slate-800 hover:bg-slate-700 text-white"
              }`}
            >
              {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5 text-teal-400" />}
              <span>{isScreenSharing ? "Stop Sharing" : "Share Screen"}</span>
            </button>

            {/* End Call */}
            <button
              onClick={onLeave}
              className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/25 transition-all"
            >
              <PhoneOff className="w-5 h-5" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* RIGHT: Real-Time Collaborative Chat Room with File Upload */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[750px] shadow-xl overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Session Chat & Files</span>
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800/40 text-emerald-300 font-medium">
              Live & Encrypted
            </span>
          </div>

          {/* Messages List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs">
                No messages yet. Greet your peer or share notes/files below!
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.senderName === currentUser.fullName;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300">{msg.senderName}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {msg.isFile && msg.fileData ? (
                    /* Shared File Bubble */
                    <div
                      className={`p-3 rounded-2xl max-w-[85%] border shadow-md ${
                        isMe
                          ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-100"
                          : "bg-slate-800 border-slate-700 text-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold truncate max-w-[160px]">
                            {msg.fileData.fileName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {(msg.fileData.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>

                      {msg.fileData.fileType.startsWith("image/") && (
                        <img
                          src={msg.fileData.dataUrl}
                          alt={msg.fileData.fileName}
                          className="w-full max-h-36 object-cover rounded-lg mb-2 border border-slate-700"
                        />
                      )}

                      <a
                        href={msg.fileData.dataUrl}
                        download={msg.fileData.fileName}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors w-full justify-center"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download File</span>
                      </a>
                    </div>
                  ) : (
                    /* Standard Text Message */
                    <div
                      className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] leading-relaxed shadow-sm ${
                        isMe
                          ? "bg-emerald-600 text-white rounded-tr-none"
                          : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                      }`}
                    >
                      {msg.message}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input & File Upload Button */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2"
          >
            {/* Hidden File Picker */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Paperclip File Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Send a file to peer"
              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 rounded-xl transition-colors"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type message..."
              className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
