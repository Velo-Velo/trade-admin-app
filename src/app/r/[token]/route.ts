import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const now = new Date();
  const invoice = await prisma.invoice.findUnique({ where: { reviewToken: token }, include: { trader: true } });
  if (invoice) {
    if (!invoice.reviewClickedAt) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { reviewClickedAt: now } });
    }
    if (invoice.trader.googleReviewUrl.startsWith("https://")) {
      return NextResponse.redirect(invoice.trader.googleReviewUrl);
    }
  }
  const quote = await prisma.quote.findUnique({ where: { reviewToken: token }, include: { trader: true } });
  if (quote) {
    if (!quote.reviewClickedAt) {
      await prisma.quote.update({ where: { id: quote.id }, data: { reviewClickedAt: now } });
    }
    if (quote.trader.googleReviewUrl.startsWith("https://")) {
      return NextResponse.redirect(quote.trader.googleReviewUrl);
    }
  }
  if (!invoice && !quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response("The review link is not set up yet. No further review notes will be sent.", { status: 200 });
}
