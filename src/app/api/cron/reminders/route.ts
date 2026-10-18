import { NextResponse } from "next/server";
import { runReminders } from "@/lib/checklist/run-reminders";
import { bearerMatches } from "@/lib/price-book/splitstick";

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const result = await runReminders();
  return NextResponse.json(result);
}
