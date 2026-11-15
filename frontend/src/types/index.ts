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

export interface IncomingCallData {
  fromUser: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    headline?: string;
    skillsOffered?: UserSkillItem[];
  };
  roomId: string;
  requestedSkill?: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderUserId?: string;
  senderName: string;
  message: string;
  timestamp: string;
  isFile?: boolean;
  fileData?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    dataUrl: string;
  };
}

