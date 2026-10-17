"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  checkPassword,
  clearSessionCookie,
  consumeMagicLink,
  createMagicLink,
  createSession,
  devLinksVisible,
  hashPassword,
  hashToken,
  normaliseEmail,
  SESSION_COOKIE,
} from "@/lib/auth";
import { cookies } from "next/headers";
import { sendEmail } from "@/lib/email";
import { requestOrigin } from "@/lib/origin";
import { safeNextPath } from "@/lib/format";
import { redirectWith } from "@/lib/redirects";

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function registerAccount(formData: FormData) {
  const email = normaliseEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  if (!validEmail(email)) redirectWith("/register", "error", "Enter a valid email address.");
  if (password.length < 8 || password.length > 72) {
    redirectWith("/register", "error", "Use a password of at least 8 characters.");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirectWith("/register", "error", "An account with that email already exists. Sign in instead.");
  }
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
  await createSession(user.id);
  redirect("/onboarding");
}

export async function signInWithPassword(formData: FormData) {
  const email = normaliseEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  const next = safeNextPath(String(formData.get("next") || ""));
  const user = await prisma.user.findUnique({ where: { email }, include: { trader: true } });
  if (!user?.passwordHash || !(await checkPassword(password, user.passwordHash))) {
    redirectWith(`/login?next=${encodeURIComponent(next)}`, "error", "That email or password is not right.");
  }
  await createSession(user.id);
  redirect(user.trader ? next : "/onboarding");
}

export async function requestMagicLink(formData: FormData) {
  const email = normaliseEmail(String(formData.get("email") || ""));
  if (!validEmail(email)) redirectWith("/login", "error", "Enter a valid email address.");
  const token = await createMagicLink(email);
  const origin = await requestOrigin();
  const url = `${origin}/magic?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: "Your Quotestick sign-in link",
    text: `This link signs you in and works once, for 30 minutes.\n\n${url}\n\nIf you did not ask for it, ignore this email.`,
  });
  if (devLinksVisible()) {
    redirect(`/login/sent?link=${encodeURIComponent(url)}`);
  }
  redirect("/login/sent");
}

export async function confirmMagicLink(formData: FormData) {
  const token = String(formData.get("token") || "");
  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    redirectWith("/login", "error", "That sign-in link has expired or already been used.");
  }
  let user = await prisma.user.findUnique({ where: { email: consumed.email }, include: { trader: true } });
  if (!user) {
    user = await prisma.user.create({ data: { email: consumed.email }, include: { trader: true } });
  }
  await createSession(user.id);
  redirect(user.trader ? "/dashboard" : "/onboarding");
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  await clearSessionCookie();
  redirect("/");
}
