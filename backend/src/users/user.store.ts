import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { logger } from "../config/index.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "users-store.json");

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
  private users: Map<string, PlatformUser> = new Map();
  private onlineUserIds: Set<string> = new Set();

  constructor(private prisma: PrismaClient) {
    this.ensureDataDir();
    this.loadFromDisk();
    logger.info(`UserStore initialized. Currently holding ${this.users.size} persisted user profile(s).`);
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e: any) {
      logger.warn({ err: e.message }, "Could not create data directory for user store");
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, "utf-8");
        const list: PlatformUser[] = JSON.parse(raw);
        for (const u of list) {
          // Default online to false on boot until socket connects
          this.users.set(u.id, { ...u, isOnline: false });
        }
        logger.info(`Loaded ${list.length} user(s) from persistent disk storage (${STORE_FILE})`);
      }
    } catch (e: any) {
      logger.warn({ err: e.message }, "Failed to read users from disk storage");
    }
  }

  private saveToDisk() {
    try {
      this.ensureDataDir();
      const list = Array.from(this.users.values());
      fs.writeFileSync(STORE_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (e: any) {
      logger.warn({ err: e.message }, "Failed to persist users to disk storage");
    }
  }

  async quickLogin(fullName: string, email: string, mobileNumber: string): Promise<{ user: PlatformUser; isNewUser: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Search in memory / disk cache
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === normalizedEmail) {
        u.fullName = fullName.trim() || u.fullName;
        u.mobileNumber = mobileNumber.trim() || u.mobileNumber;
        u.isOnline = true;
        this.onlineUserIds.add(u.id);
        this.saveToDisk();

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

    // 2. Search in Prisma DB
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
        this.saveToDisk();
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
      creditBalance: 1.0,
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
    this.saveToDisk();

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
      logger.debug({ err: e.message }, "Prisma DB offline, user saved in persistent disk store");
    }

    return { user: newUser, isNewUser: true };
  }

  syncUser(user: PlatformUser): PlatformUser {
    if (!user || !user.id) return user;

    const existing = this.users.get(user.id);
    const merged: PlatformUser = {
      ...(existing || {}),
      ...user,
      skillsOffered: user.skillsOffered && user.skillsOffered.length > 0 ? user.skillsOffered : (existing?.skillsOffered || []),
      skillsWanted: user.skillsWanted && user.skillsWanted.length > 0 ? user.skillsWanted : (existing?.skillsWanted || []),
      isOnline: true,
      setupCompleted: user.setupCompleted ?? (existing?.setupCompleted ?? true),
    };

    this.users.set(user.id, merged);
    this.onlineUserIds.add(user.id);
    this.saveToDisk();
    logger.info({ userId: user.id, fullName: user.fullName }, "User synced into store");
    return merged;
  }

  updateSkills(
    userId: string,
    skillsOffered: Array<{ name: string; level: any; category?: string } | string>,
    skillsWanted: string[],
    headline?: string
  ): PlatformUser {
    let user = this.users.get(userId);
    if (!user) {
      user = {
        id: userId,
        fullName: "Peer User",
        email: "user@example.com",
        mobileNumber: "",
        headline: headline || "Peer Mentor",
        avatarUrl: `https://api.dicebear.com/8.x/identicon/svg?seed=${userId}`,
        timeZone: "UTC",
        creditBalance: 1.0,
        reputationScore: 5.0,
        totalSessionsTaught: 0,
        skillsOffered: [],
        skillsWanted: [],
        isOnline: true,
        setupCompleted: true,
        createdAt: new Date().toISOString(),
      };
      this.users.set(userId, user);
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
    user.isOnline = true;
    this.onlineUserIds.add(userId);

    this.saveToDisk();
    return user;
  }

  updateProfile(userId: string, updates: Partial<PlatformUser>): PlatformUser {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    Object.assign(user, updates);
    this.saveToDisk();

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
    const normalizedExclude = excludeUserId?.toLowerCase().trim();

    for (const [id, user] of this.users.entries()) {
      if (normalizedExclude && id.toLowerCase().trim() === normalizedExclude) {
        continue;
      }

      // If user has no skills offered, supply a friendly default so they are always visible
      const effectiveSkills = user.skillsOffered && user.skillsOffered.length > 0
        ? user.skillsOffered
        : [{ name: "Peer Learning & Skill Exchange", level: "INTERMEDIATE" as const, category: "General" }];

      list.push({
        ...user,
        skillsOffered: effectiveSkills,
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
