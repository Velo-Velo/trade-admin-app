"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { splitForInvoice } from "@/lib/cis/calc";
import { parseCisProfile, parseCustomerCis } from "@/lib/cis/settings";
import { enforceFeature } from "@/server/guards";
import { redirectWith } from "@/lib/redirects";

export async function saveCisProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  const parsed = parseCisProfile({
    status: String(formData.get("cisStatus") || ""),
    utr: String(formData.get("cisUtr") || ""),
  });
  if (!parsed.ok) redirectWith("/business", "error", parsed.error);
  await prisma.trader.update({
    where: { id: user.trader.id },
    data: { cisStatus: parsed.cisStatus, cisUtr: parsed.cisUtr },
  });
  redirectWith("/business", "notice", "CIS status saved. It is a record for you. Nothing has been sent to HMRC.");
}

export async function saveCustomerCis(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("customerId") || "");
  const customer = await prisma.customer.findFirst({ where: { id, traderId: user.trader.id } });
  if (!customer) redirectWith("/customers", "error", "That customer could not be found.");
  const parsed = parseCustomerCis({
    deducts: formData.get("deductsCis") === "on",
    override: String(formData.get("cisRateOverride") || ""),
  });
  if (!parsed.ok) redirectWith(`/customers/${id}`, "error", parsed.error);
  await prisma.customer.update({
    where: { id: customer.id },
    data: { deductsCis: parsed.deductsCis, cisRateOverride: parsed.cisRateOverride },
  });
  redirectWith(`/customers/${id}`, "notice", "CIS setting saved for this customer. Nothing has been sent to them or to HMRC.");
}

export async function saveInvoiceCis(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("invoiceId") || "");
  enforceFeature(user, "cis", `/invoices/${id}`);
  const invoice = await prisma.invoice.findFirst({ where: { id, traderId: user.trader.id } });
  if (!invoice) redirectWith("/invoices", "error", "That invoice could not be found.");
  if (invoice.status !== "DRAFT") {
    redirectWith(`/invoices/${id}`, "error", "CIS figures stay as they were when you approved the invoice.");
  }
  const parsed = splitForInvoice({
    netPence: invoice.netPence,
    totalPence: invoice.totalPence,
    labourRaw: String(formData.get("labour") || ""),
    materialsRaw: String(formData.get("materials") || ""),
    cisApplies: formData.get("cisApplies") === "on",
    rateRaw: String(formData.get("cisRate") || ""),
  });
  if (!parsed.ok) redirectWith(`/invoices/${id}`, "error", parsed.error);
  const detail = parsed.cisApplies
    ? `CIS record saved at ${parsed.cisRate}% on labour. Not sent to the customer or to HMRC.`
    : "CIS deduction removed from this draft. Nothing was sent.";
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      labourPence: parsed.labourPence,
      materialsPence: parsed.materialsPence,
      cisApplies: parsed.cisApplies,
      cisRate: parsed.cisRate,
      cisDeductionPence: parsed.cisDeductionPence,
      amountDuePence: parsed.amountDuePence,
      events: { create: { type: "cis_saved", channel: "web", detail } },
    },
  });
  redirectWith(`/invoices/${id}`, "notice", detail);
}
