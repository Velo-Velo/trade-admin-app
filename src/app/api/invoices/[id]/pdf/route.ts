import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.trader) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { id } = await context.params;
  const invoice = await prisma.invoice.findFirst({ where: { id, traderId: user.trader.id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderInvoicePdf({ ...invoice, issuedAt: invoice.createdAt, paymentUrl: invoice.stripePaymentUrl });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
