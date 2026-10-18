import { NextResponse } from "next/server";
import { reportError } from "@/lib/monitor";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`monitor:${ip}`, 20, 60 * 60 * 1000).ok) {
    return NextResponse.json({ ok: true });
  }
  let body: { message?: unknown; digest?: unknown; source?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message : "Unknown error";
  const digest = typeof body.digest === "string" ? body.digest : "";
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : "client";
  await reportError({ message, digest, source });
  return NextResponse.json({ ok: true });
}
