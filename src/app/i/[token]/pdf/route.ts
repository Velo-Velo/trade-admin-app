import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolvePublicInvoiceView } from "@/lib/invoices/approval";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const invoice = resolvePublicInvoiceView(await prisma.invoice.findUnique({ where: { publicToken: token } }));
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderInvoicePdf({ ...invoice, issuedAt: invoice.createdAt, paymentUrl: invoice.stripePaymentUrl });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
