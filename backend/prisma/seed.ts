import { PrismaClient, ProficiencyLevel, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding SkillSwap database...");

  // 1. Create Skill Categories
  const devopsCategory = await prisma.skillCategory.upsert({
    where: { slug: "devops-cloud" },
    update: {},
    create: {
      name: "Cloud & DevOps Engineering",
      slug: "devops-cloud",
      description: "Kubernetes, Docker, Terraform, CI/CD, and Cloud-Native Infrastructure",
    },
  });

  const fullstackCategory = await prisma.skillCategory.upsert({
    where: { slug: "fullstack-web" },
    update: {},
    create: {
      name: "Full-Stack Web Development",
      slug: "fullstack-web",
      description: "React, Node.js, TypeScript, Next.js, and Modern Web Applications",
    },
  });

  const aiCategory = await prisma.skillCategory.upsert({
    where: { slug: "ai-machine-learning" },
    update: {},
    create: {
      name: "AI & Machine Learning",
      slug: "ai-machine-learning",
      description: "LLMs, PyTorch, Model Fine-Tuning, and Agentic Engineering",
    },
  });

  // 2. Create Skills
  const k8sSkill = await prisma.skill.upsert({
    where: { slug: "kubernetes" },
    update: {},
    create: {
      name: "Kubernetes & Cloud Orchestration",
      slug: "kubernetes",
      description: "Cluster management, Helm charts, Ingress, and GitOps deployments",
      categoryId: devopsCategory.id,
    },
  });

  const reactSkill = await prisma.skill.upsert({
    where: { slug: "react-typescript" },
    update: {},
    create: {
      name: "React.js & TypeScript Architecture",
      slug: "react-typescript",
      description: "Hooks, TanStack Query, state machines, and performant UI components",
      categoryId: fullstackCategory.id,
    },
  });

  const webrtcSkill = await prisma.skill.upsert({
    where: { slug: "webrtc-realtime" },
    update: {},
    create: {
      name: "WebRTC & Real-Time Media Streaming",
      slug: "webrtc-realtime",
      description: "SDP negotiation, ICE candidates, STUN/TURN, and low-latency audio/video",
      categoryId: fullstackCategory.id,
    },
  });

  const llmSkill = await prisma.skill.upsert({
    where: { slug: "llm-agentic-systems" },
    update: {},
    create: {
      name: "Agentic AI & LLM Systems",
      slug: "llm-agentic-systems",
      description: "Function calling, MCP tools, prompt engineering, and autonomous agents",
      categoryId: aiCategory.id,
    },
  });

  // 3. Create Seed Users
  const userElena = await prisma.user.upsert({
    where: { email: "elena.cloud@example.com" },
    update: {},
    create: {
      email: "elena.cloud@example.com",
      fullName: "Elena Rostova",
      headline: "Staff Cloud & Kubernetes Architect",
      bio: "10+ years in distributed systems and cloud-native architecture.",
      timeZone: "UTC+1",
      role: UserRole.USER,
      creditBalance: 5.0,
      reputationScore: 4.95,
      totalSessionsTaught: 18,
      hoursContributed: 18.0,
    },
  });

  const userMarcus = await prisma.user.upsert({
    where: { email: "marcus.dev@example.com" },
    update: {},
    create: {
      email: "marcus.dev@example.com",
      fullName: "Marcus Vance",
      headline: "Senior Frontend Engineer & React Specialist",
      bio: "Building fast, accessible web applications and real-time WebRTC collaborative tools.",
      timeZone: "UTC-5",
      role: UserRole.USER,
      creditBalance: 3.0,
      reputationScore: 4.88,
      totalSessionsTaught: 12,
      hoursContributed: 12.0,
    },
  });

  // 4. Map Skills Offered & Wanted (creating mutual reciprocity)
  await prisma.userSkillOffered.upsert({
    where: {
      userId_skillId: { userId: userElena.id, skillId: k8sSkill.id },
    },
    update: {},
    create: {
      userId: userElena.id,
      skillId: k8sSkill.id,
      level: ProficiencyLevel.EXPERT,
      yearsOfExp: 8,
      isVerified: true,
      description: "Production EKS, GKE, service mesh (Istio), and GitOps with ArgoCD.",
    },
  });

  await prisma.userSkillWanted.upsert({
    where: {
      userId_skillId: { userId: userElena.id, skillId: reactSkill.id },
    },
    update: {},
    create: {
      userId: userElena.id,
      skillId: reactSkill.id,
      targetLevel: ProficiencyLevel.ADVANCED,
      notes: "Looking to level up modern React 18 concurrent features and custom hooks.",
    },
  });

  await prisma.userSkillOffered.upsert({
    where: {
      userId_skillId: { userId: userMarcus.id, skillId: reactSkill.id },
    },
    update: {},
    create: {
      userId: userMarcus.id,
      skillId: reactSkill.id,
      level: ProficiencyLevel.EXPERT,
      yearsOfExp: 6,
      isVerified: true,
      description: "Deep expertise in React rendering lifecycles and WebRTC video integration.",
    },
  });

  await prisma.userSkillWanted.upsert({
    where: {
      userId_skillId: { userId: userMarcus.id, skillId: k8sSkill.id },
    },
    update: {},
    create: {
      userId: userMarcus.id,
      skillId: k8sSkill.id,
      targetLevel: ProficiencyLevel.INTERMEDIATE,
      notes: "Eager to learn container orchestration, Helm packaging, and Ingress routing.",
    },
  });

  console.log("✅ Seed completed successfully!");
  console.log(`- Created categories: ${devopsCategory.name}, ${fullstackCategory.name}, ${aiCategory.name}`);
  console.log(`- Created skills: ${k8sSkill.name}, ${reactSkill.name}, ${webrtcSkill.name}, ${llmSkill.name}`);
  console.log(`- Created users with reciprocal swap potential: Elena Rostova <--> Marcus Vance`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

