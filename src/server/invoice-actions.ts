"use server";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashToken, newToken } from "@/lib/auth";
import { parseInvoiceText } from "@/lib/invoices/parse";
import { parsePaymentSettings } from "@/lib/invoices/settings";
import { approveInvoice, createDraftInvoice, markInvoicePaid } from "@/lib/invoices/store";
import { requestOrigin } from "@/lib/origin";
import { isNextRedirect, redirectWith } from "@/lib/redirects";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function requireTrader() {
  return getCurrentUser().then((user) => user?.trader ?? null);
}

export async function createInvoiceFromText(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const parsed = parseInvoiceText(String(formData.get("text") || ""));
  if (!parsed.ok) redirectWith("/invoices", "error", parsed.error);
  const invoice = await createDraftInvoice({ traderId: trader.id, parsed: parsed.data, source: "dashboard" });
  redirectWith(`/invoices/${invoice.id}`, "notice", "Draft invoice created. The customer has not been sent anything.");
}

export async function approveInvoiceAction(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("invoiceId") || "");
  const origin = await requestOrigin();
  try {
    const approved = await approveInvoice(id, trader.id, origin);
    if (!approved) redirectWith("/invoices", "error", "That invoice could not be found.");
    redirectWith(`/invoices/${id}`, "notice", approved.customerDetail);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirectWith(`/invoices/${id}`, "error", error instanceof Error ? error.message : "That invoice could not be approved.");
  }
}

export async function markInvoicePaidAction(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("invoiceId") || "");
  const updated = await markInvoicePaid(id, trader.id, "Marked paid by the trader. Payment reminders have stopped.");
  if (!updated) redirectWith(`/invoices/${id}`, "error", "Approve the invoice before marking it paid.");
  redirectWith(`/invoices/${id}`, "notice", "Marked paid. Payment reminders have stopped.");
}

export async function markJobCompleteAction(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("id") || "");
  const kind = String(formData.get("kind") || "invoice");
  const now = new Date();
  if (kind === "quote") {
    const quote = await prisma.quote.findFirst({ where: { id, traderId: trader.id } });
    if (!quote || quote.status === "DRAFT") {
      redirectWith(`/quotes/${id}`, "error", "Approve the quote before marking the job complete.");
    }
    await prisma.quote.update({
      where: { id },
      data: { jobCompletedAt: quote.jobCompletedAt ?? now, reviewToken: quote.reviewToken ?? newToken() },
    });
    redirectWith(`/quotes/${id}`, "notice", "Job marked complete. Review notes can start if they are switched on.");
  }
  const invoice = await prisma.invoice.findFirst({ where: { id, traderId: trader.id } });
  if (!invoice || invoice.status === "DRAFT") {
    redirectWith(`/invoices/${id}`, "error", "Approve the invoice before marking the job complete.");
  }
  await prisma.invoice.update({
    where: { id },
    data: { jobCompletedAt: invoice.jobCompletedAt ?? now },
  });
  redirectWith(`/invoices/${id}`, "notice", "Job marked complete. Review notes can start if they are switched on.");
}

export async function updateQuoteReview(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("id") || "");
  await prisma.quote.updateMany({
    where: { id, traderId: trader.id },
    data: { reviewChaserEnabled: formData.get("reviewChaserEnabled") === "on" },
  });
  redirectWith(`/quotes/${id}`, "notice", "Review setting saved.");
}

export async function updateInvoiceFollowUps(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("invoiceId") || "");
  await prisma.invoice.updateMany({
    where: { id, traderId: trader.id },
    data: {
      chaserEnabled: formData.get("chaserEnabled") === "on",
      reviewChaserEnabled: formData.get("reviewChaserEnabled") === "on",
    },
  });
  redirectWith(`/invoices/${id}`, "notice", "Reminder settings saved.");
}

export async function updatePaymentSettings(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const parsed = parsePaymentSettings({
    bankAccountName: String(formData.get("bankAccountName") || ""),
    bankSortCode: String(formData.get("bankSortCode") || ""),
    bankAccountNumber: String(formData.get("bankAccountNumber") || ""),
    tradingAddress: String(formData.get("tradingAddress") || ""),
    vatRegistered: formData.get("vatRegistered") === "on",
    vatNumber: String(formData.get("vatNumber") || ""),
    googleReviewUrl: String(formData.get("googleReviewUrl") || ""),
    reviewChasersEnabled: formData.get("reviewChasersEnabled") === "on",
  });
  if (!parsed.ok) redirectWith("/business", "error", parsed.error);
  await prisma.trader.update({ where: { id: trader.id }, data: parsed.data });
  redirectWith("/business", "notice", "Invoice and review settings saved.");
}

export async function createWhatsAppLink() {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const bytes = randomBytes(6);
  const code = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
  await prisma.trader.update({
    where: { id: trader.id },
    data: {
      whatsappLinkCodeHash: hashToken(code),
      whatsappLinkExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  redirectWith("/business", "notice", `Send this from your WhatsApp within 30 minutes: LINK ${code}`);
}

export async function unlinkWhatsApp() {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  await prisma.trader.update({
    where: { id: trader.id },
    data: { whatsappE164: null, whatsappLinkCodeHash: null, whatsappLinkExpiresAt: null },
  });
  redirectWith("/business", "notice", "WhatsApp number unlinked.");
}
