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
  type MagicPurposeName,
} from "@/lib/auth";
import { cookies } from "next/headers";
import { DEMO_EMAIL, demoModeEnabled, isDemoEmail } from "@/lib/demo";
import { sendEmail } from "@/lib/email";
import { requestOrigin } from "@/lib/origin";
import { safeNextPath } from "@/lib/format";
import { rateLimit, REGISTER_LIMIT, SIGN_IN_LIMIT } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { redirectWith } from "@/lib/redirects";
import { seedSampleTrader } from "../../scripts/seed-sample-trader";

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function sendAccountLink(input: {
  email: string;
  purpose: MagicPurposeName;
  path: string;
  subject: string;
  intro: string;
}): Promise<string> {
  const token = await createMagicLink(input.email, input.purpose);
  const origin = await requestOrigin();
  const url = `${origin}${input.path}?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: input.email,
    subject: input.subject,
    text: `${input.intro}\n\n${url}\n\nIf you did not ask for it, ignore this email.`,
    sandbox: isDemoEmail(input.email),
  });
  return url;
}

export async function registerAccount(formData: FormData) {
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, REGISTER_LIMIT.limit, REGISTER_LIMIT.windowMs).ok) {
    redirectWith("/register", "error", "Too many accounts started from this network. Wait an hour and try again.");
  }
  const email = normaliseEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  if (!validEmail(email)) redirectWith("/register", "error", "Enter a valid email address.");
  if (isDemoEmail(email)) {
    redirectWith("/register", "error", "That email is reserved for the sample account. Use Try the demo.");
  }
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
  const url = await sendAccountLink({
    email,
    purpose: "VERIFY_EMAIL",
    path: "/magic",
    subject: "Confirm your Quotestick email",
    intro: "Confirm this email before quotes or invoices can be sent to a customer. The link works once, for 30 minutes.",
  });
  if (devLinksVisible()) {
    redirect(`/onboarding?verify=${encodeURIComponent(url)}`);
  }
  redirect("/onboarding");
}

export async function signInWithPassword(formData: FormData) {
  const ip = await clientIp();
  if (!rateLimit(`signin:${ip}`, SIGN_IN_LIMIT.limit, SIGN_IN_LIMIT.windowMs).ok) {
    redirectWith("/login", "error", "Too many sign-in attempts from this network. Wait 15 minutes and try again.");
  }
  const email = normaliseEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  const next = safeNextPath(String(formData.get("next") || ""));
  if (isDemoEmail(email) && !demoModeEnabled()) {
    redirectWith(`/login?next=${encodeURIComponent(next)}`, "error", "The sample account is only available from Try the demo.");
  }
  const user = await prisma.user.findUnique({ where: { email }, include: { trader: true } });
  if (!user?.passwordHash || !(await checkPassword(password, user.passwordHash))) {
    redirectWith(`/login?next=${encodeURIComponent(next)}`, "error", "That email or password is not right.");
  }
  await createSession(user.id);
  redirect(user.trader ? next : "/onboarding");
}

export async function signInDemo() {
  try {
    await seedSampleTrader(prisma);
  } catch (error) {
    console.error("[demo]", error);
    redirectWith("/login", "error", "The sample business could not be opened. No other account was changed.");
  }
  const user = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { trader: true },
  });
  if (!user?.trader) {
    redirectWith("/login", "error", "The sample business could not be opened. No other account was changed.");
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function requestMagicLink(formData: FormData) {
  const ip = await clientIp();
  if (!rateLimit(`signin:${ip}`, SIGN_IN_LIMIT.limit, SIGN_IN_LIMIT.windowMs).ok) {
    redirectWith("/login", "error", "Too many sign-in attempts from this network. Wait 15 minutes and try again.");
  }
  const email = normaliseEmail(String(formData.get("email") || ""));
  if (!validEmail(email)) redirectWith("/login", "error", "Enter a valid email address.");
  if (isDemoEmail(email) && !demoModeEnabled()) {
    redirectWith("/login", "error", "The sample account is only available from Try the demo.");
  }
  const url = await sendAccountLink({
    email,
    purpose: "SIGN_IN",
    path: "/magic",
    subject: "Your Quotestick sign-in link",
    intro: "This link signs you in and works once, for 30 minutes.",
  });
  if (devLinksVisible()) {
    redirect(`/login/sent?link=${encodeURIComponent(url)}`);
  }
  redirect("/login/sent");
}

export async function requestPasswordReset(formData: FormData) {
  const ip = await clientIp();
  if (!rateLimit(`reset:${ip}`, REGISTER_LIMIT.limit, REGISTER_LIMIT.windowMs).ok) {
    redirectWith("/login", "error", "Too many password resets from this network. Wait an hour and try again.");
  }
  const email = normaliseEmail(String(formData.get("email") || ""));
  if (!validEmail(email)) redirectWith("/login", "error", "Enter a valid email address.");
  if (isDemoEmail(email)) {
    redirectWith("/login", "error", "The sample account has no password. Use Try the demo.");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const url = await sendAccountLink({
      email,
      purpose: "RESET_PASSWORD",
      path: "/reset",
      subject: "Set a new Quotestick password",
      intro: "Use this link to set a new password. It works once, for 30 minutes.",
    });
    if (devLinksVisible()) {
      redirect(`/login/sent?link=${encodeURIComponent(url)}`);
    }
  }
  redirectWith("/login", "notice", "If that email has an account, a password link is on its way.");
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const back = `/reset?token=${encodeURIComponent(token)}`;
  if (password.length < 8 || password.length > 72) {
    redirectWith(back, "error", "Use a password of at least 8 characters.");
  }
  const consumed = await consumeMagicLink(token);
  if (!consumed || consumed.purpose !== "RESET_PASSWORD") {
    redirectWith("/login", "error", "That password link has expired or already been used.");
  }
  if (isDemoEmail(consumed.email)) {
    redirectWith("/login", "error", "The sample account has no password. Use Try the demo.");
  }
  const user = await prisma.user.findUnique({ where: { email: consumed.email }, include: { trader: true } });
  if (!user) redirectWith("/login", "error", "There is no account for that link.");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
  await createSession(user.id);
  redirect(user.trader ? "/dashboard" : "/onboarding");
}

export async function resendVerification() {
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirectWith("/account", "notice", "This email is already confirmed.");
  const url = await sendAccountLink({
    email: user.email,
    purpose: "VERIFY_EMAIL",
    path: "/magic",
    subject: "Confirm your Quotestick email",
    intro: "Confirm this email before quotes or invoices can be sent to a customer. The link works once, for 30 minutes.",
  });
  if (devLinksVisible()) {
    redirect(`/login/sent?link=${encodeURIComponent(url)}`);
  }
  redirectWith("/account", "notice", "Confirmation link sent. Check your email.");
}

export async function confirmMagicLink(formData: FormData) {
  const token = String(formData.get("token") || "");
  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    redirectWith("/login", "error", "That sign-in link has expired or already been used.");
  }
  if (consumed.purpose === "RESET_PASSWORD") {
    redirectWith("/login", "error", "That link sets a password. Open the reset page from the email.");
  }
  if (isDemoEmail(consumed.email) && !demoModeEnabled()) {
    redirectWith("/login", "error", "The sample account is only available from Try the demo.");
  }
  let user = await prisma.user.findUnique({ where: { email: consumed.email }, include: { trader: true } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: consumed.email, emailVerifiedAt: new Date() },
      include: { trader: true },
    });
  } else if (!user.emailVerifiedAt) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
      include: { trader: true },
    });
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
