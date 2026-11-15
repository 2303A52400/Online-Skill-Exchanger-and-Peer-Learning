import { PrismaClient, ProficiencyLevel } from "@prisma/client";

export interface ReciprocalMatch {
  peerUser: {
    id: string;
    fullName: string;
    email: string;
    reputationScore: number;
    timeZone: string;
  };
  theyTeachYou: {
    skillId: string;
    skillName: string;
    level: ProficiencyLevel;
  };
  youTeachThem: {
    skillId: string;
    skillName: string;
    level: ProficiencyLevel;
  };
}

export interface TeacherRecommendation {
  teacher: {
    id: string;
    fullName: string;
    headline: string | null;
    reputationScore: number;
    totalSessionsTaught: number;
    timeZone: string;
  };
  skill: {
    id: string;
    name: string;
    level: ProficiencyLevel;
    yearsOfExp: number;
  };
  matchScore: number;
}

export class MatchmakingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Identifies direct reciprocal swap opportunities:
   * Finds peers where:
   * 1. Peer offers a skill that target user wants.
   * 2. Target user offers a skill that the peer wants.
   */
  async findReciprocalSwaps(userId: string): Promise<ReciprocalMatch[]> {
    // 1. Fetch skills target user wants and offers
    const myWantedSkills = await this.prisma.userSkillWanted.findMany({
      where: { userId },
      select: { skillId: true },
    });

    const myOfferedSkills = await this.prisma.userSkillOffered.findMany({
      where: { userId },
      select: { skillId: true, level: true, skill: { select: { id: true, name: true } } },
    });

    if (myWantedSkills.length === 0 || myOfferedSkills.length === 0) {
      return [];
    }

    const wantedSkillIds = myWantedSkills.map((w) => w.skillId);
    const offeredSkillIds = myOfferedSkills.map((o) => o.skillId);

    // 2. Find candidate peers who offer what I want
    const candidatePeers = await this.prisma.userSkillOffered.findMany({
      where: {
        skillId: { in: wantedSkillIds },
        userId: { not: userId },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            reputationScore: true,
            timeZone: true,
          },
        },
        skill: {
          select: { id: true, name: true },
        },
      },
    });

    const matches: ReciprocalMatch[] = [];

    // 3. For each candidate peer, verify if they want what I offer
    for (const candidate of candidatePeers) {
      const peerWantedMatch = await this.prisma.userSkillWanted.findFirst({
        where: {
          userId: candidate.userId,
          skillId: { in: offeredSkillIds },
        },
        include: {
          skill: { select: { id: true, name: true } },
        },
      });

      if (peerWantedMatch) {
        const myMatchingOffer = myOfferedSkills.find((o) => o.skillId === peerWantedMatch.skillId);

        matches.push({
          peerUser: {
            id: candidate.user.id,
            fullName: candidate.user.fullName,
            email: candidate.user.email,
            reputationScore: Number(candidate.user.reputationScore),
            timeZone: candidate.user.timeZone,
          },
          theyTeachYou: {
            skillId: candidate.skill.id,
            skillName: candidate.skill.name,
            level: candidate.level,
          },
          youTeachThem: {
            skillId: peerWantedMatch.skill.id,
            skillName: peerWantedMatch.skill.name,
            level: myMatchingOffer ? myMatchingOffer.level : ProficiencyLevel.INTERMEDIATE,
          },
        });
      }
    }

    return matches;
  }

  /**
   * Ranks available teachers for a time-bank credit session
   * based on reputation, teaching history, and proficiency.
   */
  async recommendTeachersForSkill(skillId: string, learnerId?: string): Promise<TeacherRecommendation[]> {
    const teachers = await this.prisma.userSkillOffered.findMany({
      where: {
        skillId,
        ...(learnerId ? { userId: { not: learnerId } } : {}),
      },
      include: {
        user: true,
        skill: true,
      },
    });

    const recommendations = teachers.map((item) => {
      const rep = Number(item.user.reputationScore);
      const sessions = item.user.totalSessionsTaught;
      const exp = item.yearsOfExp;

      // Weighted scoring formula
      const score = (rep / 5.0) * 0.5 + Math.min(sessions / 20.0, 1.0) * 0.3 + Math.min(exp / 10.0, 1.0) * 0.2;

      return {
        teacher: {
          id: item.user.id,
          fullName: item.user.fullName,
          headline: item.user.headline,
          reputationScore: rep,
          totalSessionsTaught: sessions,
          timeZone: item.user.timeZone,
        },
        skill: {
          id: item.skill.id,
          name: item.skill.name,
          level: item.level,
          yearsOfExp: item.yearsOfExp,
        },
        matchScore: parseFloat(score.toFixed(2)),
      };
    });

    return recommendations.sort((a, b) => b.matchScore - a.matchScore);
  }
}

