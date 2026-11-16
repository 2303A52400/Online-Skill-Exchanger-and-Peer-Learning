import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { PlatformUser, IncomingCallData } from "./types";
import { Navbar } from "./components/Navbar.tsx";
import { LoginView } from "./components/LoginView.tsx";
import { SkillsSetupView } from "./components/SkillsSetupView.tsx";
import { DashboardView } from "./components/DashboardView.tsx";
import { ProfileModal } from "./components/ProfileModal.tsx";
import { IncomingCallModal } from "./components/IncomingCallModal.tsx";
import { PeerLearningRoom } from "./components/PeerLearningRoom.tsx";

export default function App() {
  const [currentUser, setCurrentUser] = useState<PlatformUser | null>(() => {
    const saved = localStorage.getItem("skillswap_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [currentView, setCurrentView] = useState<"LOGIN" | "SETUP_SKILLS" | "DASHBOARD" | "ROOM">(() => {
    const saved = localStorage.getItem("skillswap_user");
    if (!saved) return "LOGIN";
    const user = JSON.parse(saved);
    return user.setupCompleted ? "DASHBOARD" : "SETUP_SKILLS";
  });

  const [peers, setPeers] = useState<PlatformUser[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Modals & Calls
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [callingPeerId, setCallingPeerId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activePeer, setActivePeer] = useState<PlatformUser | null>(null);

  // -------------------------------------------------------------
  // 1. Socket.io Connection & Event Listeners
  // -------------------------------------------------------------
  useEffect(() => {
    const socketInstance = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
      if (currentUser) {
        socketInstance.emit("register-user", {
          user: currentUser,
          userId: currentUser.id,
          userName: currentUser.fullName,
        });
      }
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    // Incoming Call Notification
    socketInstance.on("incoming-call", (callData: IncomingCallData) => {
      setIncomingCall(callData);
    });

    // Call Accepted by Peer
    socketInstance.on("call-accepted", ({ roomId }: { roomId: string }) => {
      setCallingPeerId(null);
      setActiveRoomId(roomId);
      setCurrentView("ROOM");
    });

    // Call Declined
    socketInstance.on("call-declined", ({ message }: { message: string }) => {
      setCallingPeerId(null);
      alert(message || "Peer declined connection.");
    });

    // Call Failed
    socketInstance.on("call-failed", ({ message }: { message: string }) => {
      setCallingPeerId(null);
      alert(message || "User is currently offline.");
    });

    // User online status changes in real-time
    socketInstance.on("user-status-changed", ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setPeers((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, isOnline } : p))
      );
    });

    // Automatically update list of peers when a new user logs in or adds skills
    socketInstance.on("peers-updated", () => {
      fetchPeers();
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [currentUser?.id]);

  // -------------------------------------------------------------
  // 2. Fetch Active Community Peers
  // -------------------------------------------------------------
  const fetchPeers = async () => {
    try {
      const url = currentUser ? `/api/v1/peers?excludeUserId=${currentUser.id}` : "/api/v1/peers";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPeers(data.peers || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (currentUser) {
      // Sync user profile to backend to ensure disk persistence
      fetch("/api/v1/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: currentUser }),
      }).then(() => fetchPeers()).catch(() => {});

      // Periodically refresh peers list
      fetchPeers();
      const interval = setInterval(fetchPeers, 4000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.id]);

  // -------------------------------------------------------------
  // 3. User Authentication Handlers
  // -------------------------------------------------------------
  const handleLoginSuccess = (user: PlatformUser, isNewUser: boolean) => {
    setCurrentUser(user);
    localStorage.setItem("skillswap_user", JSON.stringify(user));

    if (socket) {
      socket.emit("register-user", {
        user,
        userId: user.id,
        userName: user.fullName,
      });
    }

    // Immediately sync to server
    fetch("/api/v1/users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user }),
    }).then(() => fetchPeers()).catch(() => {});

    if (isNewUser || !user.setupCompleted) {
      setCurrentView("SETUP_SKILLS");
    } else {
      setCurrentView("DASHBOARD");
    }
  };

  const handleSetupComplete = (updatedUser: PlatformUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("skillswap_user", JSON.stringify(updatedUser));
    setCurrentView("DASHBOARD");
    fetchPeers();
  };

  const handleProfileUpdated = (updatedUser: PlatformUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("skillswap_user", JSON.stringify(updatedUser));
    fetchPeers();
  };

  const handleLogout = () => {
    localStorage.removeItem("skillswap_user");
    setCurrentUser(null);
    setCurrentView("LOGIN");
  };

  // -------------------------------------------------------------
  // 4. Peer Connection & Call Handling
  // -------------------------------------------------------------
  const handleConnectWithPeer = (peer: PlatformUser, skillName: string) => {
    if (!socket || !currentUser) return;
    setCallingPeerId(peer.id);
    setActivePeer(peer);

    socket.emit("call-user", {
      toUserId: peer.id,
      fromUser: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        headline: currentUser.headline,
        avatarUrl: currentUser.avatarUrl,
        skillsOffered: currentUser.skillsOffered,
      },
      requestedSkill: skillName,
    });
  };

  const handleAcceptCall = (roomId: string, callerUserId: string) => {
    if (!socket) return;
    socket.emit("accept-call", { roomId, callerUserId });
    setActiveRoomId(roomId);
    setIncomingCall(null);
    setCurrentView("ROOM");
  };

  const handleDeclineCall = (callerUserId: string) => {
    if (!socket) return;
    socket.emit("decline-call", { callerUserId });
    setIncomingCall(null);
  };

  const handleLeaveRoom = () => {
    if (socket && activeRoomId) {
      socket.emit("leave-room", { roomId: activeRoomId });
    }
    setActiveRoomId(null);
    setActivePeer(null);
    setCurrentView("DASHBOARD");
  };

  // -------------------------------------------------------------
  // 5. Render View Flow
  // -------------------------------------------------------------
  if (currentView === "LOGIN" || !currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentView === "SETUP_SKILLS") {
    return (
      <SkillsSetupView
        user={currentUser}
        onSetupComplete={handleSetupComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navbar with Profile Logo at Top-Left */}
      <Navbar
        user={currentUser}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
        isConnected={isConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === "DASHBOARD" && (
          <DashboardView
            currentUser={currentUser}
            peers={peers}
            onConnectWithPeer={handleConnectWithPeer}
            onRefreshPeers={fetchPeers}
            callingPeerId={callingPeerId}
          />
        )}

        {currentView === "ROOM" && activeRoomId && (
          <PeerLearningRoom
            socket={socket}
            roomId={activeRoomId}
            currentUser={currentUser}
            peerUser={activePeer}
            onLeave={handleLeaveRoom}
          />
        )}
      </main>

      {/* Top-Left Profile Logo Edit Modal */}
      <ProfileModal
        user={currentUser}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* Incoming Call Notification Pop-Up */}
      <IncomingCallModal
        callData={incomingCall}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />
    </div>
  );
}
