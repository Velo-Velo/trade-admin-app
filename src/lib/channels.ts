import { sendEmail, type EmailResult } from "@/lib/email";
import { sendWhatsAppText, whatsappConfigured } from "@/lib/whatsapp/client";

/**
 * Quote and invoice delivery.
 * Email is always registered. WhatsApp sends only when the Meta token and
 * phone number id are set. Customer messages are still refused until the
 * trader has approved: callers must use the approval gate before deliver().
 */
export type DeliveryChannel = "email" | "whatsapp";

export type DeliveryMessage = {
  channel: DeliveryChannel;
  to: string;
  subject: string;
  text: string;
  sandbox?: boolean;
};

export type DeliverySender = (message: DeliveryMessage) => Promise<EmailResult>;

const senders = new Map<DeliveryChannel, DeliverySender>();

export function registerDeliverySender(channel: DeliveryChannel, sender: DeliverySender): void {
  senders.set(channel, sender);
}

export function clearDeliverySenders(): void {
  senders.clear();
}

export function availableChannels(): DeliveryChannel[] {
  return [...senders.keys()];
}

export async function deliver(message: DeliveryMessage): Promise<EmailResult> {
  const sender = senders.get(message.channel);
  if (!sender) {
    throw new Error(
      message.channel === "whatsapp"
        ? "WhatsApp is not set up. Quotes are sent by email and a web link."
        : `No delivery sender for ${message.channel}.`,
    );
  }
  return sender(message);
}

registerDeliverySender("email", (message) =>
  sendEmail({ to: message.to, subject: message.subject, text: message.text, sandbox: message.sandbox }),
);

registerDeliverySender("whatsapp", async (message) => {
  if (message.sandbox) {
    return { delivered: false, stubbed: true, detail: "Sample account. WhatsApp was not sent." };
  }
  if (!whatsappConfigured()) {
    throw new Error("WhatsApp is not set up. Add the Meta token and phone number id.");
  }
  await sendWhatsAppText(message.to, `${message.subject}\n\n${message.text}`);
  return { delivered: true, stubbed: false, detail: "Sent on WhatsApp." };
});
