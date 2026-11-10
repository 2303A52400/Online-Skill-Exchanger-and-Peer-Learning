import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface PeerLearningRoomProps {
  roomId: string;
  userId: string;
  userName: string;
  onLeave: () => void;
}

interface ChatMessage {
  senderName: string;
  message: string;
  timestamp: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const PeerLearningRoom: React.FC<PeerLearningRoomProps> = ({
  roomId,
  userId,
  userName,
  onLeave,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [peerConnected, setPeerConnected] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    // 1. Connect to Socket.io Signaling Gateway
    const newSocket = io("/", {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    setSocket(newSocket);

    // 2. Initialize Media Devices & PeerConnection
    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Add local tracks to RTCPeerConnection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Listen for remote audio/video tracks
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setPeerConnected(true);
          }
        };

        // Forward local ICE candidates to peer via signaling server
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            newSocket.emit("ice-candidate", {
              roomId,
              candidate: event.candidate,
            });
          }
        };

        // Join Room
        newSocket.emit("join-room", { roomId, userId, userName });

        // When existing peers are reported, initiate offer as caller
        newSocket.on("existing-peers", async ({ peers }: { peers: string[] }) => {
          if (peers.length > 0) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            newSocket.emit("webrtc-offer", { roomId, sdp: offer });
          }
        });

        // Receive offer from caller
        newSocket.on("webrtc-offer", async ({ sdp }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          newSocket.emit("webrtc-answer", { roomId, sdp: answer });
        });

        // Receive answer from callee
        newSocket.on("webrtc-answer", async ({ sdp }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        });

        // Receive remote ICE candidates
        newSocket.on("ice-candidate", async ({ candidate }) => {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("Error adding remote ICE candidate", e);
          }
        });

        // Real-time Chat
        newSocket.on("receive-chat-message", (msg: ChatMessage) => {
          setMessages((prev) => [...prev, msg]);
        });

        // Peer Disconnected
        newSocket.on("peer-disconnected", () => {
          setPeerConnected(false);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
        });

        // Whiteboard sync listeners
        newSocket.on("whiteboard-draw", (drawData: { x0: number; y0: number; x1: number; y1: number }) => {
          drawOnCanvas(drawData.x0, drawData.y0, drawData.x1, drawData.y1, false);
        });

        newSocket.on("whiteboard-clear", () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
          }
        });
      } catch (err) {
        console.error("Failed to access media devices or initialize WebRTC", err);
      }
    };

    startCall();

    return () => {
      // Teardown tracks & peer connection
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      pcRef.current?.close();
      newSocket.disconnect();
    };
  }, [roomId, userId, userName]);

  // Whiteboard drawing logic
  const drawOnCanvas = (x0: number, y0: number, x1: number, y1: number, emit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.closePath();

    if (emit && socket) {
      socket.emit("whiteboard-draw", {
        roomId,
        drawData: { x0, y0, x1, y1 },
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    (canvasRef.current as any).lastX = e.clientX - rect.left;
    (canvasRef.current as any).lastY = e.clientY - rect.top;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const lastX = (canvasRef.current as any).lastX;
    const lastY = (canvasRef.current as any).lastY;

    drawOnCanvas(lastX, lastY, currentX, currentY, true);

    (canvasRef.current as any).lastX = currentX;
    (canvasRef.current as any).lastY = currentY;
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
  };

  const handleClearWhiteboard = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      socket?.emit("whiteboard-clear", { roomId });
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    socket.emit("send-chat-message", {
      roomId,
      message: chatInput,
      senderName: userName,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setChatInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", color: "#f8fafc" }}>
      {/* Top Session Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#1e293b",
          padding: "1rem",
          borderRadius: "8px",
        }}
      >
        <div>
          <span style={{ fontWeight: 600 }}>Room ID:</span> {roomId} |{" "}
          <span style={{ color: peerConnected ? "#10b981" : "#f59e0b" }}>
            {peerConnected ? "● Peer Connected" : "○ Waiting for Peer..."}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={toggleAudio}
            style={{
              padding: "0.5rem 1rem",
              background: isAudioMuted ? "#ef4444" : "#334155",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {isAudioMuted ? "Unmute Mic" : "Mute Mic"}
          </button>
          <button
            onClick={toggleVideo}
            style={{
              padding: "0.5rem 1rem",
              background: isVideoDisabled ? "#ef4444" : "#334155",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {isVideoDisabled ? "Turn On Camera" : "Turn Off Camera"}
          </button>
          <button
            onClick={onLeave}
            style={{
              padding: "0.5rem 1rem",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Leave Session
          </button>
        </div>
      </div>

      {/* Main Grid: Video Streams & Collaborative Whiteboard */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Video Feeds */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ position: "relative", background: "#0f172a", borderRadius: "8px", overflow: "hidden" }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: "100%", height: "240px", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            <div style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: "4px" }}>
              Remote Peer
            </div>
          </div>

          <div style={{ position: "relative", background: "#0f172a", borderRadius: "8px", overflow: "hidden" }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "240px", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            <div style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: "4px" }}>
              You ({userName})
            </div>
          </div>
        </div>

        {/* Collaborative Whiteboard */}
        <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontWeight: 600 }}>Real-Time Whiteboard</span>
            <button
              onClick={handleClearWhiteboard}
              style={{
                background: "#475569",
                border: "none",
                color: "#fff",
                padding: "0.25rem 0.75rem",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Clear Canvas
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={480}
            height={440}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              background: "#090d16",
              borderRadius: "4px",
              cursor: "crosshair",
              border: "1px solid #334155",
            }}
          />
        </div>
      </div>

      {/* In-Session Collaborative Chat */}
      <div style={{ background: "#1e293b", padding: "1rem", borderRadius: "8px" }}>
        <h3 style={{ margin: "0 0 0.5rem 0" }}>In-Session Chat</h3>
        <div
          style={{
            height: "120px",
            overflowY: "auto",
            background: "#0f172a",
            padding: "0.5rem",
            borderRadius: "4px",
            marginBottom: "0.5rem",
          }}
        >
          {messages.length === 0 ? (
            <p style={{ color: "#64748b", margin: 0 }}>No messages yet. Say hello!</p>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} style={{ marginBottom: "4px" }}>
                <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>[{m.timestamp}] </span>
                <strong style={{ color: "#38bdf8" }}>{m.senderName}: </strong>
                <span>{m.message}</span>
              </div>
            ))
          )}
        </div>
        <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message or code snippet..."
            style={{
              flex: 1,
              padding: "0.5rem",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "4px",
              color: "#fff",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "0.5rem 1rem",
              background: "#2563eb",
              border: "none",
              color: "#fff",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
