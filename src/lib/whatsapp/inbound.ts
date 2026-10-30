import type { PreparedPhoto } from "@/lib/images/prepare";
import { captureWhatsAppReceipt, type ReceiptImage, type ReceiptStore } from "@/lib/receipts/capture";
import type { ReceiptReader } from "@/lib/receipts/read";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";

export type InboundPiece =
  | { kind: "text"; from: string; id: string; text: string }
  | { kind: "audio"; from: string; id: string; audioId: string }
  | { kind: "image"; from: string; id: string; imageId: string; mime: string; caption: string }
  | { kind: "unsupported"; from: string; id: string };

type RawMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  audio?: { id?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; caption?: string };
};

function messagesFrom(payload: unknown): RawMessage[] {
  if (!payload || typeof payload !== "object") return [];
  const entry = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entry)) return [];
  const messages: RawMessage[] = [];
  for (const item of entry) {
    const changes = item && typeof item === "object" ? (item as { changes?: unknown }).changes : undefined;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = change && typeof change === "object" ? (change as { value?: { messages?: unknown } }).value : undefined;
      const list = value?.messages;
      if (!Array.isArray(list)) continue;
      for (const message of list) {
        if (message && typeof message === "object") messages.push(message as RawMessage);
      }
    }
  }
  return messages;
}

export function authoriseWebhook(
  raw: string,
  signature: string | null,
  appSecret: string | undefined,
): { ok: true; payload: unknown } | { ok: false; status: 501 | 401 | 400; error: string } {
  if (!appSecret) return { ok: false, status: 501, error: "WhatsApp app secret is not set" };
  if (!verifyMetaSignature(raw, signature, appSecret)) return { ok: false, status: 401, error: "Invalid signature" };
  try {
    return { ok: true, payload: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
}

export function listInboundPieces(payload: unknown): InboundPiece[] {
  const pieces: InboundPiece[] = [];
  for (const message of messagesFrom(payload)) {
    if (!message.from || !message.id) continue;
    if (message.type === "image" && message.image?.id) {
      pieces.push({
        kind: "image",
        from: message.from,
        id: message.id,
        imageId: message.image.id,
        mime: message.image.mime_type || "image/jpeg",
        caption: (message.image.caption || "").slice(0, 500),
      });
      continue;
    }
    const documentMime = message.document?.mime_type || "";
    if (message.type === "document" && message.document?.id && documentMime.startsWith("image/")) {
      pieces.push({
        kind: "image",
        from: message.from,
        id: message.id,
        imageId: message.document.id,
        mime: documentMime,
        caption: (message.document.caption || "").slice(0, 500),
      });
      continue;
    }
    if (message.type === "document") {
      pieces.push({ kind: "unsupported", from: message.from, id: message.id });
      continue;
    }
    if (message.type === "audio" && message.audio?.id) {
      pieces.push({ kind: "audio", from: message.from, id: message.id, audioId: message.audio.id });
      continue;
    }
    const text = message.text?.body ?? "";
    if (!text.trim()) continue;
    pieces.push({ kind: "text", from: message.from, id: message.id, text });
  }
  return pieces;
}

export async function acceptReceiptPhoto(input: {
  from: string;
  id: string;
  imageId: string;
  caption: string;
  viaMeta: boolean;
  origin: string;
  read: ReceiptReader | null;
  download: (mediaId: string) => Promise<{ bytes: Uint8Array; mime: string } | null>;
  prepare: (bytes: Uint8Array) => Promise<PreparedPhoto>;
  store: ReceiptStore;
  now?: Date;
}): Promise<{ replies: string[]; expenseId: string | null }> {
  const claimed = await input.store.claim(input.id);
  if (!claimed) return { replies: [], expenseId: null };
  const media = await input.download(input.imageId);
  let image: ReceiptImage | null = null;
  let prepareError: string | null = null;
  if (!media) {
    prepareError = "Quotestick could not download it from WhatsApp.";
  } else {
    const prepared = await input.prepare(media.bytes);
    if (!prepared.ok) prepareError = prepared.error;
    else {
      image = {
        bytes: new Uint8Array(prepared.bytes),
        mimeType: "image/jpeg",
        filename: "receipt.jpg",
      };
    }
  }
  return captureWhatsAppReceipt(
    {
      from: input.from,
      caption: input.caption,
      viaMeta: input.viaMeta,
      image,
      prepareError,
      origin: input.origin,
      read: input.read,
      now: input.now,
    },
    input.store,
  );
}
