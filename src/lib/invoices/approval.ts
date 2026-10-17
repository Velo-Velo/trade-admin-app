export class InvoiceNotApprovedError extends Error {
  readonly code = "INVOICE_NOT_APPROVED";

  constructor(
    message = "This invoice is still a draft. Approve it before the customer can open it or be chased for payment.",
  ) {
    super(message);
    this.name = "InvoiceNotApprovedError";
  }
}

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID";

export function canViewInvoicePublicly(status: InvoiceStatus): boolean {
  return status === "SENT" || status === "PAID";
}

export function resolvePublicInvoiceView<T extends { status: InvoiceStatus }>(invoice: T | null): T | null {
  if (!invoice || !canViewInvoicePublicly(invoice.status)) return null;
  return invoice;
}

export function approveInvoiceDraft(status: InvoiceStatus): "SENT" {
  if (status !== "DRAFT") throw new Error("Only a draft invoice can be approved.");
  return "SENT";
}

/** Customer path. Refuses drafts even when a token already exists. */
export function customerInvoicePath(status: InvoiceStatus, publicToken: string): { path: string } {
  if (!canViewInvoicePublicly(status)) throw new InvoiceNotApprovedError();
  if (!publicToken) throw new Error("Missing public token.");
  return { path: `/i/${publicToken}` };
}
