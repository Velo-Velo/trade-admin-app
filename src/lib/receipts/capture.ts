import { normaliseWhatsAppNumber } from "@/lib/whatsapp/interpret";
import { isSandboxTrader } from "@/lib/sandbox";
import { UNLINKED_RECEIPT_REPLY, receiptPhotoFailedText, receiptSavedText } from "@/lib/receipts/copy";
import { readReceiptFields, type ReceiptReader } from "@/lib/receipts/read";
import type { ExpenseCategoryName } from "@/lib/receipts/fields";
import type { ReceiptJob } from "@/lib/receipts/match";

/**
 * Saves a receipt photo against the trader whose verified WhatsApp number sent it.
 * Available on every plan. VAT figures are copied for the trader and their accountant.
 * Nothing here is filed with HMRC.
 */

export type VerifiedTrader = {
  id: string;
  businessName: string;
  slug: string;
  email: string;
};

export type ReceiptImage = {
  bytes: Uint8Array;
  mimeType: "image/jpeg";
  filename: string;
};

export type NewExpense = {
  traderId: string;
  supplier: string;
  description: string;
  spentOn: string | null;
  totalPence: number | null;
  vatPence: number | null;
  category: ExpenseCategoryName;
  extractionNote: string;
  filename: string;
  bytes: Uint8Array;
  jobId: string | null;
  customerId: string | null;
};

export type ReceiptStore = {
  claim(externalId: string): Promise<boolean>;
  findVerifiedTrader(phone: string): Promise<VerifiedTrader | null>;
  listJobs(traderId: string): Promise<ReceiptJob[]>;
  createExpense(expense: NewExpense): Promise<{ id: string }>;
  remember(row: { phone: string; traderId: string | null; direction: "in" | "out"; body: string }): Promise<void>;
  reply(row: { phone: string; traderId: string | null; text: string; viaMeta: boolean; sandbox: boolean }): Promise<void>;
};

/** A stored number counts only after the trader has sent a link code from that phone. */
export function traderForReceipt<T extends { whatsappVerifiedAt: Date | null }>(trader: T | null): T | null {
  if (!trader?.whatsappVerifiedAt) return null;
  return trader;
}

export async function captureWhatsAppReceipt(
  input: {
    from: string;
    externalId?: string;
    caption: string;
    viaMeta: boolean;
    image: ReceiptImage | null;
    prepareError: string | null;
    origin: string;
    read: ReceiptReader | null;
    now?: Date;
  },
  store: ReceiptStore,
): Promise<{ replies: string[]; expenseId: string | null }> {
  const replies: string[] = [];
  if (input.externalId) {
    const claimed = await store.claim(input.externalId);
    if (!claimed) return { replies, expenseId: null };
  }

  const phone = normaliseWhatsAppNumber(input.from);
  if (!phone) return { replies, expenseId: null };
  const sender = phone;

  const trader = await store.findVerifiedTrader(sender);
  const sandbox = trader ? isSandboxTrader({ slug: trader.slug, email: trader.email }) : false;
  const traderId = trader?.id ?? null;

  async function say(text: string) {
    replies.push(text);
    await store.reply({ phone: sender, traderId, text, viaMeta: input.viaMeta, sandbox });
  }

  const caption = input.caption.trim().slice(0, 500);
  const inbound = caption ? `Receipt photo. ${caption}` : "Receipt photo.";
  await store.remember({ phone: sender, traderId, direction: "in", body: inbound });

  if (!trader) {
    await say(UNLINKED_RECEIPT_REPLY);
    return { replies, expenseId: null };
  }

  if (!input.image) {
    await say(receiptPhotoFailedText(input.prepareError));
    return { replies, expenseId: null };
  }

  const jobs = await store.listJobs(trader.id);
  const draft = await readReceiptFields({
    caption,
    jobs,
    bytes: input.image.bytes,
    mimeType: input.image.mimeType,
    read: input.read,
    now: input.now,
  });
  const created = await store.createExpense({
    traderId: trader.id,
    supplier: draft.supplier,
    description: draft.description,
    spentOn: draft.spentOn,
    totalPence: draft.totalPence,
    vatPence: draft.vatPence,
    category: draft.category,
    extractionNote: draft.extractionNote,
    filename: input.image.filename,
    bytes: input.image.bytes,
    jobId: draft.jobId,
    customerId: draft.customerId,
  });
  const origin = input.origin.replace(/\/$/, "");
  const spentOn = draft.spentOn ? new Date(`${draft.spentOn}T00:00:00.000Z`) : null;
  await say(
    receiptSavedText({
      supplier: draft.supplier,
      spentOn,
      totalPence: draft.totalPence,
      vatPence: draft.vatPence,
      jobTitle: draft.jobTitle,
      ambiguousJob: draft.ambiguousJob,
      manual: draft.manual,
      url: `${origin}/receipts/${created.id}`,
    }),
  );
  return { replies, expenseId: created.id };
}
