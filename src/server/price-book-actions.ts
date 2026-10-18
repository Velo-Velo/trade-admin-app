"use server";

import type { LineKind, PriceSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput, poundsToPence } from "@/lib/format";
import { redirectWith } from "@/lib/redirects";
import { redirect } from "next/navigation";

function readPrice(formData: FormData):
  | { ok: false; error: string }
  | {
      ok: true;
      description: string;
      kind: LineKind;
      unit: string;
      sellPricePence: number;
      lastPaidPence: number | null;
      lastPaidAt: Date | null;
    } {
  const description = String(formData.get("description") || "").trim();
  const kind = String(formData.get("kind") || "");
  const unit = String(formData.get("unit") || "").trim();
  const sell = poundsToPence(String(formData.get("sellPrice") || ""));
  const lastPaidRaw = String(formData.get("lastPaid") || "").trim();
  const lastPaid = lastPaidRaw ? poundsToPence(lastPaidRaw) : null;
  const lastPaidAt = parseDateInput(String(formData.get("lastPaidAt") || ""));
  if (description.length < 2 || description.length > 240) {
    return { ok: false, error: "Enter a short description of the price." };
  }
  if (kind !== "LABOUR" && kind !== "MATERIAL") {
    return { ok: false, error: "Choose labour or materials." };
  }
  if (!unit || unit.length > 24) return { ok: false, error: "Enter a unit, such as hour, item or metre." };
  if (sell === null) return { ok: false, error: "Enter the sell price in pounds, such as 12.50." };
  if (lastPaidRaw && lastPaid === null) {
    return { ok: false, error: "Last paid needs to be a price, such as 9.40, or left blank." };
  }
  if (lastPaidAt && lastPaid === null) {
    return { ok: false, error: "Add the last paid amount, or clear the date." };
  }
  return {
    ok: true,
    description,
    kind,
    unit,
    sellPricePence: sell,
    lastPaidPence: lastPaid,
    lastPaidAt: lastPaid === null ? null : lastPaidAt ?? new Date(),
  };
}

export async function addPriceBookItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const price = readPrice(formData);
  if (!price.ok) redirectWith("/price-book", "error", price.error);
  await prisma.priceBookItem.create({
    data: {
      traderId: user.trader.id,
      description: price.description,
      kind: price.kind,
      unit: price.unit,
      sellPricePence: price.sellPricePence,
      lastPaidPence: price.lastPaidPence,
      lastPaidAt: price.lastPaidAt,
      source: "MANUAL",
    },
  });
  redirectWith("/price-book", "notice", "Price added.");
}

export async function updatePriceBookItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const id = String(formData.get("id") || "");
  const existing = await prisma.priceBookItem.findFirst({
    where: { id, traderId: user.trader.id },
  });
  if (!existing) redirectWith("/price-book", "error", "That price could not be found.");
  const price = readPrice(formData);
  if (!price.ok) redirectWith("/price-book", "error", price.error);
  const lastPaidChanged = price.lastPaidPence !== existing.lastPaidPence;
  const source: PriceSource = lastPaidChanged ? "MANUAL" : existing.source;
  await prisma.priceBookItem.update({
    where: { id: existing.id },
    data: {
      description: price.description,
      kind: price.kind,
      unit: price.unit,
      sellPricePence: price.sellPricePence,
      lastPaidPence: price.lastPaidPence,
      lastPaidAt: price.lastPaidAt,
      source,
      splitstickReceiptId: lastPaidChanged ? null : existing.splitstickReceiptId,
      merchant: lastPaidChanged ? null : existing.merchant,
    },
  });
  redirectWith("/price-book", "notice", "Price saved.");
}

export async function deletePriceBookItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const id = String(formData.get("id") || "");
  await prisma.priceBookItem.deleteMany({ where: { id, traderId: user.trader.id } });
  redirectWith("/price-book", "notice", "Price removed.");
}
