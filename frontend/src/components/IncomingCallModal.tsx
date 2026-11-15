import { IncomingCallData } from "../types";
import { PhoneCall, PhoneOff, Sparkles } from "lucide-react";

interface IncomingCallModalProps {
  callData: IncomingCallData | null;
  onAccept: (roomId: string, callerId: string) => void;
  onDecline: (callerId: string) => void;
}

export function IncomingCallModal({ callData, onAccept, onDecline }: IncomingCallModalProps) {
  if (!callData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden ring-4 ring-emerald-500/20">
        {/* Pulsing ring animation */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl animate-pulse pointer-events-none" />

        <div className="relative z-10">
          {/* Avatar with pulsing rings */}
          <div className="relative inline-block mb-4">
            <div className="w-20 h-20 rounded-full border-4 border-emerald-400 overflow-hidden shadow-xl mx-auto">
              <img
                src={callData.fromUser.avatarUrl || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(callData.fromUser.fullName)}`}
                alt={callData.fromUser.fullName}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-ping" />
            <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
          </div>

          <h3 className="text-xl font-bold text-white mb-1">
            {callData.fromUser.fullName}
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            {callData.fromUser.headline || "Peer Mentor"}
          </p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Wants to learn: {callData.requestedSkill || "Skill Exchange"}</span>
          </div>

          <p className="text-xs text-slate-300 mb-6">
            Incoming 1-on-1 peer session request with video, audio, whiteboard, and file exchange.
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onDecline(callData.fromUser.id)}
              className="py-3 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Decline</span>
            </button>

            <button
              onClick={() => onAccept(callData.roomId, callData.fromUser.id)}
              className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 animate-bounce transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Accept & Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
