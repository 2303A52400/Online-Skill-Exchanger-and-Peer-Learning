import { useState } from "react";
import { PlatformUser, UserSkillItem } from "../types";
import { Plus, X, Sparkles, CheckCircle2, BookOpen, GraduationCap, ArrowRight } from "lucide-react";

interface SkillsSetupViewProps {
  user: PlatformUser;
  onSetupComplete: (updatedUser: PlatformUser) => void;
}

const POPULAR_SKILLS = [
  "React.js",
  "Python",
  "Kubernetes",
  "Figma UI/UX",
  "Machine Learning",
  "Node.js",
  "WebRTC Video",
  "Cloud Architecture (AWS)",
  "Tailwind CSS",
  "Docker",
  "System Design",
  "Video Editing",
  "Public Speaking",
  "Data Structures & Algo",
];

export function SkillsSetupView({ user, onSetupComplete }: SkillsSetupViewProps) {
  const [skillsOffered, setSkillsOffered] = useState<UserSkillItem[]>([
    { name: "Web Development", level: "INTERMEDIATE", category: "Tech" },
  ]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT">("INTERMEDIATE");
  const [skillsWanted, setSkillsWanted] = useState<string[]>(["Kubernetes"]);
  const [newWantedInput, setNewWantedInput] = useState("");
  const [headline, setHeadline] = useState(user.headline || "Passionate Peer Learner");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAddOffered = (nameToAdd?: string) => {
    const name = (nameToAdd || newSkillName).trim();
    if (!name) return;
    if (skillsOffered.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      return;
    }
    setSkillsOffered([...skillsOffered, { name, level: newSkillLevel, category: "Skills" }]);
    setNewSkillName("");
  };

  const handleRemoveOffered = (index: number) => {
    setSkillsOffered(skillsOffered.filter((_, i) => i !== index));
  };

  const handleAddWanted = () => {
    const wanted = newWantedInput.trim();
    if (!wanted) return;
    if (skillsWanted.some((w) => w.toLowerCase() === wanted.toLowerCase())) return;
    setSkillsWanted([...skillsWanted, wanted]);
    setNewWantedInput("");
  };

  const handleRemoveWanted = (index: number) => {
    setSkillsWanted(skillsWanted.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (skillsOffered.length === 0) {
      setError("Please add at least 1 skill you can teach or share with peers.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/users/${user.id}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillsOffered,
          skillsWanted,
          headline,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onSetupComplete(data.user);
        return;
      }
    } catch (_) {}

    // Fallback in-memory update
    const updated: PlatformUser = {
      ...user,
      skillsOffered,
      skillsWanted,
      headline,
      setupCompleted: true,
    };
    onSetupComplete(updated);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative">
        {/* Glow */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-3">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Step 2 of 2 • Account Profile Setup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            What Skills Do You Have to Share?
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-xl mx-auto">
            SkillSwap works on reciprocal learning: teach skills you know to earn learning credits and discover skills you want to learn from other peers.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-200 text-xs text-center">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {/* Professional Headline */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Your Professional Headline or Passion
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Frontend Developer & Design System Enthusiast"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Section 1: Skills You Can Teach / Offer */}
          <div className="p-5 bg-slate-950/80 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                Skills You Can Teach <span className="text-emerald-400 font-normal text-xs">(At least 1 required)</span>
              </h2>
            </div>

            {/* Input & Level */}
            <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
              <input
                type="text"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOffered())}
                placeholder="Enter a skill (e.g. React.js, Python, Guitar)"
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <select
                value={newSkillLevel}
                onChange={(e) => setNewSkillLevel(e.target.value as any)}
                className="px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
                <option value="EXPERT">Expert</option>
              </select>

              <button
                type="button"
                onClick={() => handleAddOffered()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Skill</span>
              </button>
            </div>

            {/* Current Offered Tags */}
            <div className="flex flex-wrap gap-2 mb-4 min-h-[40px] items-center">
              {skillsOffered.map((skill, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-medium"
                >
                  <span className="font-semibold text-white">{skill.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 uppercase">
                    {skill.level}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOffered(idx)}
                    className="text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {skillsOffered.length === 0 && (
                <span className="text-xs text-slate-500 italic">No skills added yet.</span>
              )}
            </div>

            {/* Quick Suggestions */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Click to Quick Add:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SKILLS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleAddOffered(item)}
                    className="text-xs px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-700/60 hover:border-emerald-500/40 transition-colors"
                  >
                    + {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Skills You Want to Learn */}
          <div className="p-5 bg-slate-950/80 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">
                Skills You Want to Learn from Others
              </h2>
            </div>

            <div className="flex gap-2.5 mb-4">
              <input
                type="text"
                value={newWantedInput}
                onChange={(e) => setNewWantedInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddWanted())}
                placeholder="What do you want to learn? (e.g. Cloud DevOps, AI, Design)"
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={handleAddWanted}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shadow-teal-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Goal</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {skillsWanted.map((wanted, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-950/60 border border-teal-500/40 text-teal-300 text-xs font-medium"
                >
                  <span>{wanted}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveWanted(idx)}
                    className="text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Complete Setup Action */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5 text-slate-950" />
            <span>Complete Setup & Enter Dashboard</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

