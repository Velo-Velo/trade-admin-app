import { prisma } from "../src/lib/db";
import { runReminders } from "../src/lib/checklist/run-reminders";

runReminders()
  .then((result) => {
    console.log(JSON.stringify(result));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
