import { NextResponse } from "next/server";
import { billingConfigured, featureAllowed } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import { isSandboxTrader } from "@/lib/sandbox";
import { normaliseEmail } from "@/lib/auth";
import {
  applySplitstickReceipt,
  bearerMatches,
  splitstickPayloadSchema,
} from "@/lib/price-book/splitstick";

/**
 * Future Splitstick feed. Disabled until SPLITSTICK_WEBHOOK_SECRET is set.
 * Body: { email, receipt: { source: "splitstick", receiptId, description, paidPence, paidAt, merchant? } }
 */
export async function POST(request: Request) {
  const secret = process.env.SPLITSTICK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Splitstick is not connected." }, { status: 501 });
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const parsed = splitstickPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "The receipt payload was not valid." }, { status: 400 });
  }
  const trader = await prisma.trader.findFirst({
    where: { user: { email: normaliseEmail(parsed.data.email) } },
  });
  if (!trader) return NextResponse.json({ error: "No trader with that email." }, { status: 404 });
  const sandbox = isSandboxTrader({ slug: trader.slug, email: parsed.data.email });
  if (!featureAllowed({ plan: trader.plan, feature: "splitstick", sandbox, billingOn: billingConfigured() })) {
    return NextResponse.json({ error: "Receipt prices are on the Splitstick bundle." }, { status: 403 });
  }

  const existing = await prisma.priceBookItem.findFirst({
    where: {
      traderId: trader.id,
      OR: [
        { splitstickReceiptId: parsed.data.receipt.receiptId },
        { description: { equals: parsed.data.receipt.description, mode: "insensitive" } },
      ],
    },
  });
  const write = applySplitstickReceipt(parsed.data.receipt, existing);
  if (existing) {
    await prisma.priceBookItem.update({
      where: { id: existing.id },
      data: {
        description: write.description,
        kind: write.kind,
        lastPaidPence: write.lastPaidPence,
        lastPaidAt: write.lastPaidAt,
        source: write.source,
        splitstickReceiptId: write.splitstickReceiptId,
        merchant: write.merchant,
        sellPricePence: write.sellPricePence,
      },
    });
  } else {
    await prisma.priceBookItem.create({
      data: {
        traderId: trader.id,
        unit: "each",
        description: write.description,
        kind: write.kind,
        sellPricePence: write.sellPricePence,
        lastPaidPence: write.lastPaidPence,
        lastPaidAt: write.lastPaidAt,
        source: write.source,
        splitstickReceiptId: write.splitstickReceiptId,
        merchant: write.merchant,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
