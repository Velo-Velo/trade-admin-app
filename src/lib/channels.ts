import { sendEmail, type EmailResult } from "@/lib/email";

/**
 * Quote delivery channels.
 * Email is registered below. WhatsApp is intentionally not registered.
 * A later version can call registerDeliverySender("whatsapp", sender)
 * without changing the approval gate: the trader still approves first,
 * and the sender only receives the public link after status is SENT.
 */
export type DeliveryChannel = "email" | "whatsapp";

export type DeliveryMessage = {
  channel: DeliveryChannel;
  to: string;
  subject: string;
  text: string;
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
  sendEmail({ to: message.to, subject: message.subject, text: message.text }),
);
