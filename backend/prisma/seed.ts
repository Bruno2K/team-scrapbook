import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.community.count();
  if (count > 0) return;

  await prisma.community.createMany({
    data: [
      { name: "2Fort Veterans", description: "Veteranos do mapa mais icônico", memberCount: 14523, dominantClass: "Sniper", team: "RED" },
      { name: "Medics United", description: "Quem cura, vence!", memberCount: 8901, dominantClass: "Medic", team: "BLU" },
      { name: "Spy Check!", description: "Paranoia é sobrevivência", memberCount: 6234, dominantClass: "Spy" },
      { name: "Dustbowl Defenders", description: "Defenda o ponto ou morra tentando", memberCount: 11200, dominantClass: "Engineer", team: "RED" },
      { name: "Hat Trading Brasil", description: "Compra, venda e troca de hats", memberCount: 22100, dominantClass: "Scout" },
      { name: "Competitive TF2 BR", description: "Cena competitiva brasileira", memberCount: 5400 },
    ],
  });
  console.log("Seed: communities created.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
