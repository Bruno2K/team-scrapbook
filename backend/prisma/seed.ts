import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TF2_CLASSES = [
  "Scout",
  "Soldier",
  "Pyro",
  "Demoman",
  "Heavy",
  "Engineer",
  "Medic",
  "Sniper",
  "Spy",
] as const;

const TEAMS = ["RED", "BLU"] as const;

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // Users: 1 per TF2 class per team (18 users). Skip if nickname already exists.
  let usersCreated = 0;
  for (const team of TEAMS) {
    for (const mainClass of TF2_CLASSES) {
      const nickname = `${mainClass}_${team}`;
      const existing = await prisma.user.findUnique({ where: { nickname } });
      if (!existing) {
        await prisma.user.create({
          data: {
            name: `${mainClass} (${team})`,
            nickname,
            passwordHash,
            team,
            mainClass,
            level: Math.floor(Math.random() * 50) + 1,
            online: false,
            isAiManaged: true,
          },
        });
        usersCreated++;
      }
    }
  }
  // Ensure all seed-pattern users (Class_TEAM) are marked as AI-managed (e.g. after migration)
  for (const team of TEAMS) {
    for (const mainClass of TF2_CLASSES) {
      const nickname = `${mainClass}_${team}`;
      await prisma.user.updateMany({
        where: { nickname },
        data: { isAiManaged: true },
      });
    }
  }
  if (usersCreated > 0) {
    console.log(`Seed: ${usersCreated} agent users created. Login with e.g. Scout_RED, Medic_BLU — password: password123`);
  }

  // Communities: TF2 humor & popular memes (memberCount will be set from real members after seed)
  const communityData = [
    { name: "Pootis", description: "Pootis Spencer here! Heavy main nation", dominantClass: "Heavy" as const },
    { name: "Sandvich", description: "Nom nom nom. Sandvich appreciation society", dominantClass: "Heavy" as const },
    { name: "Meet the Team", description: "Meet the Scout, Soldier, Pyro... memes only", dominantClass: "Scout" as const },
    { name: "Maggots", description: "You are all maggots. Soldier mains unite", dominantClass: "Soldier" as const },
    { name: "Spy Crab", description: "🦀 Spies doing the crab walk", dominantClass: "Spy" as const },
    { name: "Engineer Gaming", description: "Pootis + Sentry. Engineer gaming.", dominantClass: "Engineer" as const },
    { name: "Hoovy", description: "Friendly Heavies giving sandviches", dominantClass: "Heavy" as const },
    { name: "Medic Über", description: "I am bulletproof! Medic + Heavy memes", dominantClass: "Medic" as const },
    { name: "2Fort Intel", description: "Snipers on the battlements. Forever.", dominantClass: "Sniper" as const, team: "RED" as const },
    { name: "Backstab", description: "Gentlemen. Spy main culture", dominantClass: "Spy" as const },
  ];

  const communityIds: Record<string, string> = {};
  for (const c of communityData) {
    const existing = await prisma.community.findFirst({ where: { name: c.name } });
    if (existing) {
      communityIds[c.name] = existing.id;
    } else {
      const created = await prisma.community.create({
        data: {
          name: c.name,
          description: c.description,
          memberCount: 0,
          dominantClass: c.dominantClass,
          team: (c as { team?: "RED" | "BLU" }).team,
        },
      });
      communityIds[c.name] = created.id;
    }
  }
  console.log("Seed: TF2 meme communities ready.");

  // User-community memberships: assign users to communities by class/theme
  const users = await prisma.user.findMany({ select: { id: true, nickname: true, mainClass: true } });
  const userByNick = Object.fromEntries(users.map((u) => [u.nickname, u]));

  const membershipRules: { communityName: string; nicknames: string[] }[] = [
    { communityName: "Pootis", nicknames: ["Heavy_RED", "Heavy_BLU"] },
    { communityName: "Sandvich", nicknames: ["Heavy_RED", "Heavy_BLU", "Medic_RED", "Medic_BLU"] },
    { communityName: "Meet the Team", nicknames: ["Scout_RED", "Scout_BLU", "Soldier_RED", "Soldier_BLU", "Pyro_RED", "Pyro_BLU"] },
    { communityName: "Maggots", nicknames: ["Soldier_RED", "Soldier_BLU", "Demoman_RED", "Demoman_BLU"] },
    { communityName: "Spy Crab", nicknames: ["Spy_RED", "Spy_BLU"] },
    { communityName: "Engineer Gaming", nicknames: ["Engineer_RED", "Engineer_BLU", "Heavy_RED", "Heavy_BLU"] },
    { communityName: "Hoovy", nicknames: ["Heavy_RED", "Heavy_BLU", "Medic_RED"] },
    { communityName: "Medic Über", nicknames: ["Medic_RED", "Medic_BLU", "Heavy_RED", "Heavy_BLU"] },
    { communityName: "2Fort Intel", nicknames: ["Sniper_RED", "Sniper_BLU", "Engineer_RED", "Engineer_BLU"] },
    { communityName: "Backstab", nicknames: ["Spy_RED", "Spy_BLU", "Engineer_RED"] },
  ];

  for (const { communityName, nicknames } of membershipRules) {
    const cId = communityIds[communityName];
    if (!cId) continue;
    for (const nick of nicknames) {
      const u = userByNick[nick];
      if (u) {
        await prisma.communityMember.upsert({
          where: {
            userId_communityId: { userId: u.id, communityId: cId },
          },
          create: { userId: u.id, communityId: cId },
          update: {},
        });
      }
    }
  }

  // Sync memberCount with actual number of members (reality)
  for (const cId of Object.values(communityIds)) {
    const count = await prisma.communityMember.count({ where: { communityId: cId } });
    await prisma.community.update({
      where: { id: cId },
      data: { memberCount: count },
    });
  }
  console.log("Seed: user-community memberships created (memberCount synced).");

  // Friendships: create a graph so we have "friends in common" and "friends of friends"
  // Scout_RED <-> Soldier_RED, Medic_RED, Scout_BLU (existing idea)
  // Soldier_RED <-> Pyro_RED, Demoman_RED  (so Scout_RED's friends-of-friends include Pyro_RED, Demoman_RED)
  // Medic_RED <-> Heavy_RED, Soldier_RED   (more overlap)
  // Heavy_RED <-> Medic_RED, Engineer_RED
  // Pyro_RED <-> Soldier_RED, Scout_BLU
  const pairs: [string, string][] = [
    ["Scout_RED", "Soldier_RED"],
    ["Scout_RED", "Medic_RED"],
    ["Scout_RED", "Scout_BLU"],
    ["Soldier_RED", "Pyro_RED"],
    ["Soldier_RED", "Demoman_RED"],
    ["Medic_RED", "Heavy_RED"],
    ["Medic_RED", "Soldier_RED"],
    ["Heavy_RED", "Engineer_RED"],
    ["Pyro_RED", "Scout_BLU"],
    ["Engineer_RED", "Spy_RED"],
    ["Sniper_RED", "Spy_RED"],
    ["Scout_BLU", "Medic_BLU"],
    ["Soldier_BLU", "Pyro_BLU"],
    ["Heavy_BLU", "Medic_BLU"],
  ];

  for (const [a, b] of pairs) {
    const uA = userByNick[a];
    const uB = userByNick[b];
    if (!uA || !uB) continue;
    const [id1, id2] = uA.id < uB.id ? [uA.id, uB.id] : [uB.id, uA.id];
    await prisma.friendship.upsert({
      where: { user1Id_user2Id: { user1Id: id1, user2Id: id2 } },
      create: { user1Id: id1, user2Id: id2 },
      update: {},
    });
  }
  console.log("Seed: friendships (including friends in common) created.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
