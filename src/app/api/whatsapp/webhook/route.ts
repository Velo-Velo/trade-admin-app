import { NextResponse } from "next/server";
import { downloadWhatsAppMedia, sendWhatsAppText, whatsappConfigured } from "@/lib/whatsapp/client";
import { handleInboundWhatsApp } from "@/lib/whatsapp/handle";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import { transcribeVoiceNote } from "@/lib/whatsapp/transcribe";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type Incoming = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          id?: string;
          type?: string;
          text?: { body?: string };
          audio?: { id?: string };
        }>;
      };
    }>;
  }>;
};

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "WhatsApp app secret is not set" }, { status: 501 });
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: Incoming;
  try {
    payload = JSON.parse(raw) as Incoming;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = payload.entry?.flatMap((entry) => entry.changes ?? []).flatMap((change) => change.value?.messages ?? []) ?? [];
  for (const message of messages) {
    if (!message.from || !message.id) continue;
    let text = message.text?.body ?? "";
    if (message.type === "audio" && message.audio?.id) {
      const media = await downloadWhatsAppMedia(message.audio.id);
      const transcript = media ? await transcribeVoiceNote(media.bytes, media.mime) : null;
      if (!transcript) {
        const hint = process.env.OPENAI_API_KEY
          ? "I couldn't transcribe that voice note. Type the job instead."
          : "Voice notes need an OpenAI key before I can transcribe them. Type the job instead.";
        if (whatsappConfigured()) {
          try {
            await sendWhatsAppText(message.from, hint);
          } catch (error) {
            console.error("[whatsapp voice]", error);
          }
        }
        continue;
      }
      text = transcript;
    }
    if (!text.trim()) continue;
    try {
      await handleInboundWhatsApp({ from: message.from, text, viaMeta: true, externalId: message.id });
    } catch (error) {
      console.error("[whatsapp inbound]", error);
    }
  }
  return NextResponse.json({ received: true });
}
