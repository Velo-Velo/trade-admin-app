const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function credentials(): { token: string; phoneId: string } {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    throw new Error("WhatsApp is not set up. Add the Meta token and phone number id.");
  }
  return { token, phoneId };
}

async function graph(path: string, init: RequestInit): Promise<Response> {
  const { token } = credentials();
  return fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const { phoneId } = credentials();
  const response = await graph(`/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4000) },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp send failed: ${detail.slice(0, 300)}`);
  }
}

export async function sendWhatsAppDocument(
  to: string,
  pdf: Buffer,
  filename: string,
  caption: string,
): Promise<void> {
  const { token, phoneId } = credentials();
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);
  const upload = await fetch(`${GRAPH}/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!upload.ok) {
    const detail = await upload.text();
    throw new Error(`WhatsApp PDF upload failed: ${detail.slice(0, 300)}`);
  }
  const media = (await upload.json()) as { id?: string };
  if (!media.id) throw new Error("WhatsApp PDF upload did not return a media id.");
  await sendDocumentMessage(to, media.id, filename, caption);
}

async function sendDocumentMessage(to: string, mediaId: string, filename: string, caption: string): Promise<void> {
  const { phoneId } = credentials();
  const response = await graph(`/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { id: mediaId, filename, caption: caption.slice(0, 900) },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp document failed: ${detail.slice(0, 300)}`);
  }
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!whatsappConfigured()) return null;
  const meta = await graph(`/${mediaId}`, { method: "GET" });
  if (!meta.ok) return null;
  const info = (await meta.json()) as { url?: string; mime_type?: string };
  if (!info.url) return null;
  const { token } = credentials();
  const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!file.ok) return null;
  return { bytes: new Uint8Array(await file.arrayBuffer()), mime: info.mime_type || "audio/ogg" };
}
