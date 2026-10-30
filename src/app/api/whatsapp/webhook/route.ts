import { NextResponse } from "next/server";
import { prepareJobPhoto } from "@/lib/images/prepare";
import { readerFromEnv } from "@/lib/receipts/read";
import { prismaReceiptStore } from "@/lib/receipts/store";
import { downloadWhatsAppMedia, sendWhatsAppText, whatsappConfigured } from "@/lib/whatsapp/client";
import { handleInboundWhatsApp } from "@/lib/whatsapp/handle";
import { acceptReceiptPhoto, authoriseWebhook, listInboundPieces } from "@/lib/whatsapp/inbound";
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

function appOrigin(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(request: Request) {
  const raw = await request.text();
  const decision = authoriseWebhook(raw, request.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET);
  if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.status });

  const pieces = listInboundPieces(decision.payload);
  for (const piece of pieces) {
    try {
      if (piece.kind === "image") {
        await acceptReceiptPhoto({
          from: piece.from,
          id: piece.id,
          imageId: piece.imageId,
          caption: piece.caption,
          viaMeta: true,
          origin: appOrigin(),
          read: readerFromEnv(),
          download: downloadWhatsAppMedia,
          prepare: prepareJobPhoto,
          store: prismaReceiptStore(),
        });
        continue;
      }
      if (piece.kind === "unsupported") {
        if (whatsappConfigured()) {
          try {
            await sendWhatsAppText(piece.from, "Send a photo of the receipt as a picture. JPG or PNG works.");
          } catch (error) {
            console.error("[whatsapp receipt]", error);
          }
        }
        continue;
      }
      if (piece.kind === "audio") {
        const media = await downloadWhatsAppMedia(piece.audioId);
        const transcript = media ? await transcribeVoiceNote(media.bytes, media.mime) : null;
        if (!transcript) {
          const hint = process.env.OPENAI_API_KEY
            ? "I couldn't transcribe that voice note. Type the job instead."
            : "Voice notes need an OpenAI key before I can transcribe them. Type the job instead.";
          if (whatsappConfigured()) {
            try {
              await sendWhatsAppText(piece.from, hint);
            } catch (error) {
              console.error("[whatsapp voice]", error);
            }
          }
          continue;
        }
        await handleInboundWhatsApp({ from: piece.from, text: transcript, viaMeta: true, externalId: piece.id });
        continue;
      }
      await handleInboundWhatsApp({ from: piece.from, text: piece.text, viaMeta: true, externalId: piece.id });
    } catch (error) {
      console.error("[whatsapp inbound]", error);
    }
  }
  return NextResponse.json({ received: true });
}
