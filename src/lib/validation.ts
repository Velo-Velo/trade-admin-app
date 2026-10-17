import { z } from "zod";
import { isHexColour } from "@/lib/brand";
import { TRADES } from "@/lib/trades";

const tradeValues = TRADES.map((trade) => trade.value) as [string, ...string[]];

const ukPostcode = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function emailOrPhoneError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Enter a valid email address.";
    return null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return "Enter an email address or a phone number.";
  }
  return null;
}

export function parseEnquiryFields(input: {
  customerName: string;
  contact: string;
  postcode: string;
  jobDescription: string;
}):
  | { ok: true; data: { customerName: string; contact: string; postcode: string; jobDescription: string } }
  | { ok: false; error: string } {
  const customerName = input.customerName.trim();
  const contact = input.contact.trim();
  const postcode = input.postcode.trim().toUpperCase();
  const jobDescription = input.jobDescription.trim();
  if (customerName.length < 2 || customerName.length > 120) {
    return { ok: false, error: "Enter the customer's name." };
  }
  const contactError = emailOrPhoneError(contact);
  if (contactError) return { ok: false, error: contactError };
  if (!ukPostcode.test(postcode)) {
    return { ok: false, error: "Enter a UK postcode, such as CO1 1AA." };
  }
  if (jobDescription.length < 10 || jobDescription.length > 4000) {
    return { ok: false, error: "Describe the job in a sentence or two." };
  }
  return { ok: true, data: { customerName, contact, postcode, jobDescription } };
}

const businessSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name.").max(80),
  trade: z.enum(tradeValues),
  area: z.string().trim().min(2, "Enter the area you cover.").max(120),
  postcodes: z.string().trim().min(2, "Enter the postcodes you cover.").max(200),
  phone: z.string().trim().min(8).max(30),
  logoText: z.string().trim().min(1, "Enter the words for your text logo.").max(40),
  brandColour: z.string().trim(),
  services: z.string().trim().min(2, "List at least one service.").max(2000),
  bio: z.string().trim().max(800).optional().default(""),
});

export function parseBusiness(input: z.input<typeof businessSchema>): 
  | { ok: true; data: z.infer<typeof businessSchema> }
  | { ok: false; error: string } {
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const digits = parsed.data.phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, error: "Enter a phone number customers can call." };
  }
  if (!isHexColour(parsed.data.brandColour)) {
    return { ok: false, error: "Pick a colour for your page." };
  }
  return { ok: true, data: parsed.data };
}

export function parseSlug(value: string): string | null {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 48) return null;
  return slug;
}
