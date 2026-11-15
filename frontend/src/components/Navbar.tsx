import { PlatformUser } from "../types";
import { Edit3, Sparkles, LogOut } from "lucide-react";

interface NavbarProps {
  user: PlatformUser;
  onOpenProfile: () => void;
  onLogout: () => void;
  isConnected: boolean;
}

export function Navbar({ user, onOpenProfile, onLogout, isConnected }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* TOP-LEFT: User's Profile Logo / Avatar button (Clickable to Edit Anything) */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenProfile}
            title="Click to edit your profile and skills"
            className="group flex items-center gap-3 p-1.5 pr-4 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-emerald-500/50 transition-all shadow-lg hover:shadow-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <div className="relative">
              <img
                src={user.avatarUrl || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(user.fullName)}`}
                alt={user.fullName}
                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 group-hover:scale-105 transition-transform"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
            </div>

            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                  {user.fullName}
                </span>
                <Edit3 className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400" />
              </div>
              <span className="text-xs text-slate-400 block max-w-[140px] truncate">
                {user.headline || "Edit Profile"}
              </span>
            </div>
          </button>

          {/* Platform Brand Tag */}
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800">
            <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              SkillSwap
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
              Peer Learning
            </span>
          </div>
        </div>

        {/* Center & Right Actions */}
        <div className="flex items-center gap-4">
          {/* Socket Connection Status */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-slate-800/60 border border-slate-700/60 text-slate-300">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className="hidden sm:inline">{isConnected ? "Live Network Active" : "Connecting..."}</span>
          </div>

          {/* Time-Bank Credit Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-inner">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>
              {user.creditBalance.toFixed(1)} Learning Credit{user.creditBalance !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Logout / Switch Account */}
          <button
            onClick={onLogout}
            title="Log out or switch user"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
