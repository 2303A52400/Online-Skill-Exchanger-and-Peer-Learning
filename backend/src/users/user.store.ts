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

export class UserStore {
  // Purely dynamic store: holds only actual users who have logged in
  private users: Map<string, PlatformUser> = new Map();
  private onlineUserIds: Set<string> = new Set();

  constructor(private prisma: PrismaClient) {
    logger.info("UserStore initialized with zero dummy profiles. Only real logged-in users are displayed.");
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

    // 3. Create fresh actual user
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
      // Only include actual registered users who have completed their setup
      if (!user.setupCompleted || user.skillsOffered.length === 0) continue;

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
