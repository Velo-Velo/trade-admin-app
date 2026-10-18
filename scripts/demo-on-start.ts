import { PrismaClient } from "@prisma/client";
import { demoModeEnabled } from "../src/lib/demo";
import { seedSampleTrader } from "./seed-sample-trader";

/**
 * Used by `npm start` after migrations. A no-op unless DEMO_MODE is exactly "true",
 * so a normal Render deploy does not create the sample trader.
 */
async function main() {
  if (!demoModeEnabled()) {
    console.log("DEMO_MODE is not true. Sample trader left unchanged.");
    return;
  }
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set, so the sample trader could not be created.");
  }
  const prisma = new PrismaClient();
  try {
    await seedSampleTrader(prisma);
    console.log("DEMO_MODE=true, so the sample trader was created or reset.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
