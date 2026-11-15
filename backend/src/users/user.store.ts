import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../config/index.js";

export interface UserSkillItem {
  name: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
  category?: string;
}

export interface PlatformUser {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  headline: string;
  bio?: string;
  avatarUrl: string;
  timeZone: string;
  creditBalance: number;
  reputationScore: number;
  totalSessionsTaught: number;
  skillsOffered: UserSkillItem[];
  skillsWanted: string[];
  isOnline: boolean;
  setupCompleted: boolean;
  createdAt: string;
}

// Default community peers available for instant skill-swapping
const INITIAL_COMMUNITY_PEERS: PlatformUser[] = [
  {
    id: "peer-elena-k8s",
    fullName: "Elena Rostova",
    email: "elena.rostova@example.com",
    mobileNumber: "+1 (555) 234-5678",
    headline: "Staff Cloud & Kubernetes Architect",
    bio: "Passionate about container orchestration, GitOps, and high-availability distributed systems.",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    timeZone: "UTC+1 (Berlin)",
    creditBalance: 4.0,
    reputationScore: 4.98,
    totalSessionsTaught: 24,
    skillsOffered: [
      { name: "Kubernetes Orchestration", level: "EXPERT", category: "DevOps" },
      { name: "Docker & Container Security", level: "EXPERT", category: "DevOps" },
      { name: "Terraform IaC", level: "ADVANCED", category: "Cloud" },
    ],
    skillsWanted: ["React.js", "WebRTC Video", "TypeScript"],
    isOnline: true,
    setupCompleted: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "peer-marcus-react",
    fullName: "Marcus Vance",
    email: "marcus.vance@example.com",
    mobileNumber: "+1 (555) 345-6789",
    headline: "Senior Frontend Engineer & React Specialist",
    bio: "Specializing in React 18 concurrent UI, WebRTC media streams, and collaborative canvases.",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    timeZone: "UTC-5 (New York)",
    creditBalance: 3.5,
    reputationScore: 4.92,
    totalSessionsTaught: 19,
    skillsOffered: [
      { name: "React 18 & Vite", level: "EXPERT", category: "Frontend" },
      { name: "WebRTC Audio/Video", level: "ADVANCED", category: "Realtime" },
      { name: "Tailwind CSS & UI Systems", level: "EXPERT", category: "Design" },
    ],
    skillsWanted: ["Kubernetes", "PostgreSQL Optimization"],
    isOnline: true,
    setupCompleted: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "peer-priya-ai",
    fullName: "Priya Sharma",
    email: "priya.sharma@example.com",
    mobileNumber: "+91 98765 43210",
    headline: "AI Research Engineer & Python Lead",
    bio: "Hands-on experience fine-tuning LLMs, PyTorch computer vision, and building agentic workflows.",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    timeZone: "UTC+5:30 (India)",
    creditBalance: 5.0,
    reputationScore: 5.0,
    totalSessionsTaught: 31,
    skillsOffered: [
      { name: "Python for Data Science", level: "EXPERT", category: "AI/ML" },
      { name: "LLM Agents & Prompt Engineering", level: "EXPERT", category: "AI/ML" },
      { name: "FastAPI & Microservices", level: "ADVANCED", category: "Backend" },
    ],
    skillsWanted: ["System Design", "Cloud Architecture"],
    isOnline: true,
    setupCompleted: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "peer-david-design",
    fullName: "David Kim",
    email: "david.kim@example.com",
    mobileNumber: "+1 (555) 789-0123",
    headline: "Product Designer & UX Researcher",
    bio: "Figma master, design systems architect, and usability tester with 7+ years craft.",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    timeZone: "UTC-8 (San Francisco)",
    creditBalance: 2.0,
    reputationScore: 4.87,
    totalSessionsTaught: 14,
    skillsOffered: [
      { name: "Figma Component Systems", level: "EXPERT", category: "Design" },
      { name: "UX Research & Wireframing", level: "EXPERT", category: "Design" },
      { name: "Interactive Prototyping", level: "ADVANCED", category: "Design" },
    ],
    skillsWanted: ["Next.js", "Tailwind CSS"],
    isOnline: true,
    setupCompleted: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "peer-sarah-backend",
    fullName: "Sarah Jenkins",
    email: "sarah.jenkins@example.com",
    mobileNumber: "+44 20 7946 0912",
    headline: "Distributed Systems & Node.js Architect",
    bio: "Passionate about event-driven architecture, Redis Pub/Sub, and robust database indexing.",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    timeZone: "UTC+0 (London)",
    creditBalance: 3.0,
    reputationScore: 4.95,
    totalSessionsTaught: 22,
    skillsOffered: [
      { name: "Node.js & Express", level: "EXPERT", category: "Backend" },
      { name: "PostgreSQL Database Design", level: "ADVANCED", category: "Database" },
      { name: "Redis Caching & PubSub", level: "ADVANCED", category: "Backend" },
    ],
    skillsWanted: ["Figma UI/UX", "Mobile Development"],
    isOnline: true,
    setupCompleted: true,
    createdAt: new Date().toISOString(),
  },
];

export class UserStore {
  private users: Map<string, PlatformUser> = new Map();
  private onlineUserIds: Set<string> = new Set();

  constructor(private prisma: PrismaClient) {
    // Populate in-memory map with initial community peers
    for (const peer of INITIAL_COMMUNITY_PEERS) {
      this.users.set(peer.id, peer);
      this.onlineUserIds.add(peer.id);
    }
  }

  async quickLogin(fullName: string, email: string, mobileNumber: string): Promise<{ user: PlatformUser; isNewUser: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Search in memory
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === normalizedEmail) {
        // Update name and mobile if changed
        u.fullName = fullName.trim() || u.fullName;
        u.mobileNumber = mobileNumber.trim() || u.mobileNumber;
        u.isOnline = true;
        this.onlineUserIds.add(u.id);

        // Try updating in Prisma if connected
        try {
          await this.prisma.user.update({
            where: { email: normalizedEmail },
            data: {
              fullName: u.fullName,
              mobileNumber: u.mobileNumber,
            },
          });
        } catch (_) {}

        return { user: u, isNewUser: !u.setupCompleted };
      }
    }

    // 2. Try looking up in Prisma DB
    try {
      const dbUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          skillsOffered: { include: { skill: true } },
          skillsWanted: { include: { skill: true } },
        },
      });

      if (dbUser) {
        const u: PlatformUser = {
          id: dbUser.id,
          fullName: fullName.trim() || dbUser.fullName,
          email: dbUser.email,
          mobileNumber: mobileNumber.trim() || dbUser.mobileNumber || "",
          headline: dbUser.headline || "Peer Learner & Contributor",
          bio: dbUser.bio || "",
          avatarUrl: dbUser.avatarUrl || `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(fullName)}`,
          timeZone: dbUser.timeZone || "UTC",
          creditBalance: Number(dbUser.creditBalance) || 1.0,
          reputationScore: Number(dbUser.reputationScore) || 5.0,
          totalSessionsTaught: dbUser.totalSessionsTaught || 0,
          skillsOffered: dbUser.skillsOffered.map((s) => ({
            name: s.skill.name,
            level: s.level,
          })),
          skillsWanted: dbUser.skillsWanted.map((w) => w.skill.name),
          isOnline: true,
          setupCompleted: dbUser.skillsOffered.length > 0,
          createdAt: dbUser.createdAt.toISOString(),
        };

        this.users.set(u.id, u);
        this.onlineUserIds.add(u.id);
        return { user: u, isNewUser: !u.setupCompleted };
      }
    } catch (_) {}

    // 3. Create fresh user
    const newUserId = uuidv4();
    const newUser: PlatformUser = {
      id: newUserId,
      fullName: fullName.trim(),
      email: normalizedEmail,
      mobileNumber: mobileNumber.trim(),
      headline: "Skill Enthusiast & Peer Mentor",
      bio: "Excited to share knowledge and learn from peers!",
      avatarUrl: `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(fullName)}`,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      creditBalance: 1.0, // Initial 1 free learning credit
      reputationScore: 5.0,
      totalSessionsTaught: 0,
      skillsOffered: [],
      skillsWanted: [],
      isOnline: true,
      setupCompleted: false,
      createdAt: new Date().toISOString(),
    };

    this.users.set(newUser.id, newUser);
    this.onlineUserIds.add(newUser.id);

    // Persist to Postgres if available
    try {
      await this.prisma.user.create({
        data: {
          id: newUser.id,
          fullName: newUser.fullName,
          email: newUser.email,
          mobileNumber: newUser.mobileNumber,
          headline: newUser.headline,
          timeZone: newUser.timeZone,
          creditBalance: newUser.creditBalance,
          reputationScore: newUser.reputationScore,
        },
      });
      logger.info({ userId: newUser.id }, "User synced to PostgreSQL database");
    } catch (e: any) {
      logger.debug({ err: e.message }, "Prisma DB offline, user saved in high-speed memory store");
    }

    return { user: newUser, isNewUser: true };
  }

  updateSkills(
    userId: string,
    skillsOffered: Array<{ name: string; level: any; category?: string } | string>,
    skillsWanted: string[],
    headline?: string
  ): PlatformUser {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const normalizedOffered: UserSkillItem[] = skillsOffered.map((s) => {
      if (typeof s === "string") {
        return { name: s.trim(), level: "INTERMEDIATE" };
      }
      return {
        name: s.name.trim(),
        level: s.level || "INTERMEDIATE",
        category: s.category || "General",
      };
    });

    const normalizedWanted = skillsWanted.map((w) => w.trim()).filter(Boolean);

    user.skillsOffered = normalizedOffered;
    user.skillsWanted = normalizedWanted;
    if (headline) user.headline = headline;
    user.setupCompleted = true;

    // Async DB update if possible
    this.syncSkillsToDatabase(user).catch(() => {});

    return user;
  }

  private async syncSkillsToDatabase(user: PlatformUser) {
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          headline: user.headline,
        },
      });
    } catch (_) {}
  }

  updateProfile(userId: string, updates: Partial<PlatformUser>): PlatformUser {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    Object.assign(user, updates);

    try {
      this.prisma.user.update({
        where: { id: userId },
        data: {
          fullName: user.fullName,
          mobileNumber: user.mobileNumber,
          headline: user.headline,
          timeZone: user.timeZone,
        },
      }).catch(() => {});
    } catch (_) {}

    return user;
  }

  getUser(userId: string): PlatformUser | undefined {
    return this.users.get(userId);
  }

  getAllPeers(excludeUserId?: string): PlatformUser[] {
    const list: PlatformUser[] = [];
    for (const [id, user] of this.users.entries()) {
      if (excludeUserId && id === excludeUserId) continue;
      // Mark online status dynamically
      list.push({
        ...user,
        isOnline: this.onlineUserIds.has(id),
      });
    }
    return list;
  }

  setUserOnline(userId: string, online: boolean) {
    if (online) {
      this.onlineUserIds.add(userId);
    } else {
      this.onlineUserIds.delete(userId);
    }
    const user = this.users.get(userId);
    if (user) {
      user.isOnline = online;
    }
  }
}

