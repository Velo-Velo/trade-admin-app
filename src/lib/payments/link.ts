import { stripeClient } from "../stripe";

/** A Stripe-hosted card payment URL. Empty when Stripe is not configured or the amount is too small. */
export async function createGbpPaymentLink(input: {
  name: string;
  amountPence: number;
  metadata: Record<string, string>;
}): Promise<{ url: string | null; id: string | null }> {
  if (!Number.isInteger(input.amountPence) || input.amountPence < 30) return { url: null, id: null };
  const stripe = stripeClient();
  if (!stripe) return { url: null, id: null };
  const link = await stripe.paymentLinks.create({
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: input.amountPence,
          product_data: { name: input.name.slice(0, 120) },
        },
      },
    ],
    metadata: input.metadata,
    payment_method_types: ["card"],
  });
  return { url: link.url, id: link.id };
}
