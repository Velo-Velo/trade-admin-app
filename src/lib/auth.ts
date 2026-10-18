import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "qs_session";
const SESSION_DAYS = 30;
const MAGIC_MINUTES = 30;

export function sessionPepper(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 16 characters in production.");
  }
  return "dev-only-session-secret-change-me";
}

export function hashToken(token: string): string {
  return createHash("sha256").update(`${sessionPepper()}:${token}`).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function checkPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function setSessionCookie(token: string, expires: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  await setSessionCookie(token, expiresAt);
}

const userWithTrader = {
  trader: true,
} as const;

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: userWithTrader } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type MagicPurposeName = "SIGN_IN" | "VERIFY_EMAIL" | "RESET_PASSWORD";

export async function createMagicLink(email: string, purpose: MagicPurposeName = "SIGN_IN"): Promise<string> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + MAGIC_MINUTES * 60 * 1000);
  await prisma.magicLink.create({
    data: { email: normaliseEmail(email), tokenHash: hashToken(token), expiresAt, purpose },
  });
  return token;
}

export async function consumeMagicLink(token: string): Promise<{ email: string; purpose: MagicPurposeName } | null> {
  const link = await prisma.magicLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!link || link.usedAt || link.expiresAt.getTime() < Date.now()) return null;
  await prisma.magicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
  return { email: link.email, purpose: link.purpose };
}

export function devLinksVisible(): boolean {
  return process.env.SHOW_DEV_LINKS === "true" && process.env.NODE_ENV !== "production";
}
