"use server";

import { getCurrentUser } from "@/lib/auth";
import { isSandboxTrader } from "@/lib/sandbox";
import { redirectWith } from "@/lib/redirects";
import { handleInboundWhatsApp } from "@/lib/whatsapp/handle";

async function linkedPhone(): Promise<{ phone: string } | null> {
  const user = await getCurrentUser();
  if (!user?.trader || !isSandboxTrader({ slug: user.trader.slug, email: user.email })) return null;
  if (!user.trader.whatsappE164) return null;
  return { phone: user.trader.whatsappE164 };
}

export async function simulateWhatsApp(formData: FormData) {
  const linked = await linkedPhone();
  if (!linked) redirectWith("/whatsapp", "error", "The simulator is only on the sample account.");
  const text = String(formData.get("text") || "").trim();
  if (!text) redirectWith("/whatsapp", "error", "Type a message first.");
  await handleInboundWhatsApp({
    from: linked.phone,
    text,
    viaMeta: false,
    externalId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  redirectWith("/whatsapp", "notice", "Message sent in the simulator. Nothing went to Meta.");
}

export async function simulateVoiceNote() {
  const linked = await linkedPhone();
  if (!linked) redirectWith("/whatsapp", "error", "The simulator is only on the sample account.");
  await handleInboundWhatsApp({
    from: linked.phone,
    text: "Voice note transcript: The kitchen tap is dripping. Please quote to replace the tap.",
    viaMeta: false,
    externalId: `sim-voice-${Date.now()}`,
  });
  redirectWith("/whatsapp", "notice", "Sample voice note used a stand-in transcript. OpenAI and Meta were not called.");
}
