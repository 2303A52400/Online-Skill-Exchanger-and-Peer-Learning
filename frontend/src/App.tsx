import { useState } from "react";
import { PeerLearningRoom } from "./components/PeerLearningRoom.tsx";

export default function App() {
  const [balance, setBalance] = useState(1.0);
  const [sessionActive, setSessionActive] = useState(false);
  const [roomId, setRoomId] = useState("skillswap-room-alpha");

  const handleHoldEscrow = () => {
    if (balance >= 1.0) {
      setBalance((prev) => prev - 1.0);
      setSessionActive(true);
    } else {
      alert("Insufficient time credits! Earn credits by teaching first.");
    }
  };

  const handleLeaveSession = () => {
    setSessionActive(false);
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "1000px", margin: "0 auto" }}>
      <header style={{ borderBottom: "1px solid #334155", paddingBottom: "1rem", marginBottom: "2rem" }}>
        <h1 style={{ color: "#38bdf8", margin: 0 }}>SkillSwap Peer Learning Platform</h1>
        <p style={{ color: "#94a3b8" }}>Time-Banking & Direct Reciprocal Skill Exchange</p>
      </header>

      {!sessionActive ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <div style={{ border: "1px solid #334155", borderRadius: "8px", padding: "1.5rem", background: "#1e293b" }}>
            <h2>Time-Bank Credit Balance</h2>
            <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#38bdf8", margin: "1rem 0" }}>
              {balance.toFixed(2)} Credits
            </div>
            <p style={{ color: "#94a3b8" }}>1 Hour Taught = 1 Learning Credit</p>
            <button
              onClick={() => setBalance((prev) => prev + 1.0)}
              style={{
                backgroundColor: "#2563eb",
                color: "#fff",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                cursor: "pointer",
                marginTop: "0.5rem",
              }}
            >
              + Simulate Teaching 1 Hour
            </button>
          </div>

          <div style={{ border: "1px solid #334155", borderRadius: "8px", padding: "1.5rem", background: "#1e293b" }}>
            <h2>1-on-1 Video Session</h2>
            <p style={{ color: "#94a3b8" }}>WebRTC Video, Audio & Collaborative Whiteboard</p>
            <div style={{ margin: "1rem 0" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "#cbd5e1" }}>Room Identifier:</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  color: "#fff",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={handleHoldEscrow}
              style={{
                backgroundColor: "#10b981",
                color: "#fff",
                border: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                width: "100%",
              }}
            >
              Escrow 1 Credit & Join Room
            </button>
          </div>
        </div>
      ) : (
        <PeerLearningRoom
          roomId={roomId}
          userId="user-test-learner-1"
          userName="Alex Rivera"
          onLeave={handleLeaveSession}
        />
      )}
    </div>
  );
}
