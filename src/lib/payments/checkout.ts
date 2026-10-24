export type ConnectedCharge = {
  name: string;
  description: string;
  amountPence: number;
  metadata: Record<string, string>;
  customerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
  stripeAccountId: string;
  feePence: number;
};

/** Direct charge on the trader's connected account. Card includes Apple Pay and Google Pay in Checkout. Bacs is not requested. */
export function connectedCheckoutArgs(charge: ConnectedCharge): {
  params: {
    mode: "payment";
    customer_email?: string;
    line_items: Array<{
      quantity: number;
      price_data: {
        currency: "gbp";
        unit_amount: number;
        product_data: { name: string; description: string };
      };
    }>;
    payment_method_types: ["card"];
    metadata: Record<string, string>;
    success_url: string;
    cancel_url: string;
    payment_intent_data?: { application_fee_amount: number };
  };
  options: { stripeAccount: string };
} {
  return {
    params: {
      mode: "payment",
      customer_email: charge.customerEmail ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: charge.amountPence,
            product_data: {
              name: charge.name.slice(0, 120),
              description: charge.description.slice(0, 200),
            },
          },
        },
      ],
      payment_method_types: ["card"],
      metadata: charge.metadata,
      success_url: charge.successUrl,
      cancel_url: charge.cancelUrl,
      ...(charge.feePence > 0 ? { payment_intent_data: { application_fee_amount: charge.feePence } } : {}),
    },
    options: { stripeAccount: charge.stripeAccountId },
  };
}

export function paidInvoicePatch(
  invoice: { paidAt: Date | null; status: string; jobCompletedAt: Date | null },
  now: Date,
): { status: "PAID"; paidAt: Date; jobCompletedAt: Date } | null {
  if (invoice.paidAt || invoice.status === "DRAFT" || invoice.status === "PAID") return null;
  return { status: "PAID", paidAt: now, jobCompletedAt: invoice.jobCompletedAt ?? now };
}
