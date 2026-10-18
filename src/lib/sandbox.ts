import { isDemoEmail, isDemoSlug } from "./demo";

export function isSandboxTrader(trader: { slug?: string | null; email?: string | null } | null | undefined): boolean {
  if (!trader) return false;
  if (trader.slug && isDemoSlug(trader.slug)) return true;
  if (trader.email && isDemoEmail(trader.email)) return true;
  return false;
}

/** Sample-account outbound mail and WhatsApp stay on the stub path even when SMTP or Meta keys exist. */
export function realOutboundAllowed(sandbox: boolean): boolean {
  return !sandbox;
}
