import { useState } from "react";
import { PlatformUser } from "../types";
import { Search, Sparkles, Video, Users, ArrowUpRight, Star, RefreshCw } from "lucide-react";

interface DashboardViewProps {
  currentUser: PlatformUser;
  peers: PlatformUser[];
  onConnectWithPeer: (peer: PlatformUser, skillName: string) => void;
  onRefreshPeers: () => void;
  callingPeerId: string | null;
}

export function DashboardView({
  currentUser,
  peers,
  onConnectWithPeer,
  onRefreshPeers,
  callingPeerId,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const categories = ["ALL", "DevOps", "Frontend", "AI/ML", "Design", "Backend"];

  // Filter peers by search query and skills
  const filteredPeers = peers.filter((peer) => {
    if (peer.id === currentUser.id) return false;

    const matchesSearch =
      peer.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      peer.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      peer.skillsOffered.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedCategory !== "ALL") {
      return peer.skillsOffered.some(
        (s) => s.category?.toUpperCase() === selectedCategory.toUpperCase()
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 sm:p-8 mb-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Peer Learning Exchange • 1 Hour Taught = 1 Credit</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Hello, <span className="text-emerald-400">{currentUser.fullName}</span>!
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Browse peers below who are online with the <span className="text-emerald-400 font-semibold">green light</span>. Check their skills and click the green <span className="text-emerald-400 font-semibold">Connect</span> button to start a live 1-on-1 video, audio & whiteboard session.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
            <div className="text-center px-3 border-r border-slate-800">
              <span className="text-2xl font-black text-emerald-400 block">
                {currentUser.creditBalance.toFixed(1)}
              </span>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Credits</span>
            </div>
            <div className="text-center px-3">
              <span className="text-2xl font-black text-white block">
                {currentUser.skillsOffered.length}
              </span>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Skills You Teach</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by peer name or skill (e.g. Kubernetes, React, Python)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={onRefreshPeers}
            title="Refresh active peers list"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Refresh</span>
          </button>

          <span className="text-xs text-slate-400 font-medium">
            <span className="text-emerald-400 font-bold">{filteredPeers.length}</span> Peer{filteredPeers.length !== 1 ? "s" : ""} Available
          </span>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              selectedCategory === cat
                ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Community Peer List Grid */}
      {filteredPeers.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-slate-800 p-8 max-w-xl mx-auto shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/70 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Other Logged-in Users Yet</h3>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            All mock profiles have been completely removed! Currently, only <strong className="text-emerald-400">real users who have logged in</strong> and added their skills appear here.
          </p>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left mb-6">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              💡 How to Test Real-Time Connection with another user:
            </span>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside">
              <li>Open a <strong className="text-white">new browser window or Incognito tab</strong>.</li>
              <li>Go to <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">http://localhost:3000</code>.</li>
              <li>Log in with a second user name, email, and mobile number.</li>
              <li>Add their skills — both users will instantly appear on each other's dashboard with the <span className="text-emerald-400 font-semibold">green light</span>!</li>
              <li>Click the green <span className="text-emerald-400 font-semibold">Connect</span> button to start a live 1-on-1 session.</li>
            </ol>
          </div>

          <button
            onClick={() => window.open(window.location.origin, "_blank")}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all inline-flex items-center gap-2"
          >
            <span>Open New Peer Tab (Incognito recommended)</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPeers.map((peer) => {
            const isBeingCalled = callingPeerId === peer.id;
            const primarySkill = peer.skillsOffered[0]?.name || "Peer Learning";

            return (
              <div
                key={peer.id}
                className="group bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:shadow-emerald-500/10 transition-all flex flex-col justify-between relative overflow-hidden"
              >
                {/* Peer Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar with Little Green Light Indicator */}
                      <div className="relative">
                        <img
                          src={peer.avatarUrl || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(peer.fullName)}`}
                          alt={peer.fullName}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700 group-hover:border-emerald-500/60 transition-colors shadow-md"
                        />
                        {/* Little Green Light indicator */}
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900" />
                        </span>
                      </div>

                      <div>
                        {/* Peer Full Name */}
                        <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {peer.fullName}
                        </h3>
                        {/* Little Green Light text badge */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-[11px] font-semibold text-emerald-400">
                            Online & Ready
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rating Badge */}
                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-950/40 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{peer.reputationScore.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Headline */}
                  <p className="text-xs text-slate-300 mb-4 line-clamp-2">
                    {peer.headline || "Dedicated Peer Learner"}
                  </p>

                  {/* SKILLS LISTED DIRECTLY BELOW THE USER NAME */}
                  <div className="mb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Skills Offered:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {peer.skillsOffered.map((skill, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{skill.name}</span>
                          <span className="text-[9px] text-slate-400 uppercase">
                            ({skill.level[0]})
                          </span>
                        </span>
                      ))}
                      {peer.skillsOffered.length === 0 && (
                        <span className="text-xs text-slate-500 italic">No skills listed</span>
                      )}
                    </div>
                  </div>

                  {/* Wants to learn */}
                  {peer.skillsWanted.length > 0 && (
                    <div className="mb-5 text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Wants to learn: </span>
                      {peer.skillsWanted.slice(0, 3).join(", ")}
                    </div>
                  )}
                </div>

                {/* GREEN COLOR CONNECT BUTTON */}
                <div className="pt-4 border-t border-slate-800/80">
                  <button
                    onClick={() => onConnectWithPeer(peer, primarySkill)}
                    disabled={isBeingCalled}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all group-hover:scale-[1.02] disabled:opacity-50"
                  >
                    <Video className="w-4 h-4 text-slate-950" />
                    <span>{isBeingCalled ? "Connecting..." : "Connect"}</span>
                    <ArrowUpRight className="w-4 h-4 text-slate-950" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
