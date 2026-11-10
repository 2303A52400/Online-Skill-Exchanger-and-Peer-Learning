import React, { useState } from "react";

export default function App() {
  const [balance, setBalance] = useState(1.0);
  const [sessionActive, setSessionActive] = useState(false);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ borderBottom: "1px solid #334155", paddingBottom: "1rem", marginBottom: "2rem" }}>
        <h1>SkillSwap Peer Learning Platform</h1>
        <p>Time-Banking & Direct Reciprocal Skill Exchange</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ border: "1px solid #334155", borderRadius: "8px", padding: "1.5rem" }}>
          <h2>Time-Bank Credit Balance</h2>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#38bdf8" }}>
            {balance.toFixed(2)} Credits
          </div>
          <p style={{ color: "#94a3b8" }}>1 Hour Taught = 1 Learning Credit</p>
        </div>

        <div style={{ border: "1px solid #334155", borderRadius: "8px", padding: "1.5rem" }}>
          <h2>1-on-1 Video Session</h2>
          <p>WebRTC & Collaborative Whiteboard Room</p>
          <button
            onClick={() => setSessionActive(!sessionActive)}
            style={{
              backgroundColor: sessionActive ? "#ef4444" : "#10b981",
              color: "#fff",
              border: "none",
              padding: "0.75rem 1.5rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {sessionActive ? "Leave Room" : "Join Learning Room"}
          </button>
        </div>
      </div>
    </div>
  );
}

