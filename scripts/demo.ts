import { PrismaClient } from "@prisma/client";
import { seedSampleTrader } from "./seed-sample-trader";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Add it to .env, then run npm run demo again.");
  }
  await seedSampleTrader(prisma);
  console.log("Set DEMO_MODE=true, then run npm run dev and open the home page.");
  console.log("Click Try the demo. No OpenAI, Stripe or SMTP keys are required.");
  console.log("Running this again resets the sample trader only.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
