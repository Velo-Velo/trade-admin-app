"use server";

import { redirect } from "next/navigation";
import type { Trade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/brand";
import { syncChecklist } from "@/lib/checklist/sync";
import { parseBusiness, parseSlug } from "@/lib/validation";
import { redirectWith } from "@/lib/redirects";

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base).slice(0, 40);
  let candidate = root || "trade";
  let suffix = 2;
  while (suffix < 1000) {
    const existing = await prisma.trader.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function readBusiness(formData: FormData) {
  return parseBusiness({
    businessName: String(formData.get("businessName") || ""),
    trade: String(formData.get("trade") || ""),
    area: String(formData.get("area") || ""),
    postcodes: String(formData.get("postcodes") || ""),
    phone: String(formData.get("phone") || ""),
    logoText: String(formData.get("logoText") || ""),
    brandColour: String(formData.get("brandColour") || ""),
    services: String(formData.get("services") || ""),
    bio: String(formData.get("bio") || ""),
  });
}

export async function completeOnboarding(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.trader) redirect("/dashboard");
  const parsed = readBusiness(formData);
  if (!parsed.ok) redirectWith("/onboarding", "error", parsed.error);
  const data = parsed.data;
  const slug = await uniqueSlug(data.businessName);
  const trader = await prisma.trader.create({
    data: {
      userId: user.id,
      businessName: data.businessName,
      slug,
      trade: data.trade as Trade,
      area: data.area,
      postcodes: data.postcodes,
      phone: data.phone,
      logoText: data.logoText || data.businessName,
      brandColour: data.brandColour,
      services: data.services,
      bio: data.bio,
    },
  });
  await syncChecklist(trader.id, trader.trade);
  redirect("/dashboard");
}

export async function updateBusiness(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const parsed = readBusiness(formData);
  if (!parsed.ok) redirectWith("/business", "error", parsed.error);
  const slug = parseSlug(String(formData.get("slug") || ""));
  if (!slug) {
    redirectWith("/business", "error", "The page address can use lowercase letters, numbers and hyphens.");
  }
  const taken = await prisma.trader.findUnique({ where: { slug } });
  if (taken && taken.id !== user.trader.id) {
    redirectWith("/business", "error", "That page address is already in use.");
  }
  const data = parsed.data;
  const trader = await prisma.trader.update({
    where: { id: user.trader.id },
    data: {
      businessName: data.businessName,
      slug,
      trade: data.trade as Trade,
      area: data.area,
      postcodes: data.postcodes,
      phone: data.phone,
      logoText: data.logoText,
      brandColour: data.brandColour,
      services: data.services,
      bio: data.bio,
    },
  });
  await syncChecklist(trader.id, trader.trade);
  redirectWith("/business", "notice", "Your page details are saved.");
}
