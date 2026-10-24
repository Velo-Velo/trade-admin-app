import { prisma } from "../db";
import { demoModeEnabled } from "../demo";
import { sendEmail } from "../email";
import { customerEmail } from "../format";
import { normalisePhone } from "../customers/match";
import { sendWhatsAppText, whatsappConfigured } from "../whatsapp/client";

export type ChaseDelivery = {
  ok: boolean;
  detail: string;
};

export async function deliverCustomerChase(input: {
  traderId: string;
  traderWhatsapp: string | null;
  contact: string;
  customerPhone: string;
  customerEmail: string;
  subject: string;
  text: string;
  sandbox?: boolean;
}): Promise<ChaseDelivery> {
  const email = input.customerEmail || customerEmail(input.contact) || "";
  const phone = normalisePhone(input.customerPhone || (email ? "" : input.contact));
  const notes: string[] = [];

  if (email) {
    const result = await sendEmail({ to: email, subject: input.subject, text: input.text, sandbox: input.sandbox });
    notes.push(result.stubbed ? "Email logged, not sent (no SMTP)." : "Email sent.");
  }

  if (phone && whatsappConfigured() && !input.sandbox) {
    try {
      await sendWhatsAppText(phone, input.text);
      await prisma.whatsAppMessage.create({
        data: { traderId: input.traderId, phone, direction: "out", body: input.text.slice(0, 4000) },
      });
      notes.push("WhatsApp sent to the customer.");
    } catch (error) {
      console.error("[chase whatsapp]", error);
      notes.push("WhatsApp could not be sent.");
    }
  } else if ((input.sandbox || demoModeEnabled()) && input.traderWhatsapp) {
    const who = phone ? ` to +${phone}` : email ? ` for ${email}` : "";
    await prisma.whatsAppMessage.create({
      data: {
        traderId: input.traderId,
        phone: input.traderWhatsapp,
        direction: "out",
        body: `Customer reminder${who} (simulator, not sent by Meta):\n\n${input.text}`.slice(0, 4000),
      },
    });
    notes.push(phone ? "Shown in the WhatsApp simulator. Meta is not connected." : "No mobile number, so WhatsApp was not used. A copy is in the simulator.");
  } else if (phone) {
    notes.push("WhatsApp is not connected, so the mobile number was not messaged.");
  }

  if (notes.length === 0) {
    return { ok: false, detail: "Add an email or a mobile number before this can be sent." };
  }
  return { ok: true, detail: notes.join(" ") };
}
