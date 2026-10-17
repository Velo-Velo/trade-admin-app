import { PrismaClient } from "@prisma/client";
import { seedJobTemplates } from "../src/lib/templates/seed-job-templates";

const prisma = new PrismaClient();

async function main() {
  const count = await seedJobTemplates(prisma);
  console.log(`Seeded ${count} plumbing and heating templates.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
