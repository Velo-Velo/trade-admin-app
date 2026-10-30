type IdValue = string | { id?: string | null } | null | undefined;

function idOf(value: IdValue): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && typeof value.id === "string" && value.id) return value.id;
  return null;
}

/**
 * Subscription invoices in the current Stripe API put the subscription on
 * parent.subscription_details. Older payloads used a top-level subscription field.
 */
export function invoiceSubscriptionIds(invoice: {
  customer?: IdValue;
  subscription?: IdValue;
  parent?: {
    subscription_details?: {
      subscription?: IdValue;
    } | null;
  } | null;
}): { customerId: string | null; subscriptionId: string | null } {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  return {
    customerId: idOf(invoice.customer),
    subscriptionId: idOf(fromParent) ?? idOf(invoice.subscription),
  };
}
