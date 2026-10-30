import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      emailVerifiedAt: true,
      createdAt: true,
      trader: {
        select: {
          businessName: true,
          slug: true,
          trade: true,
          area: true,
          postcodes: true,
          phone: true,
          services: true,
          bio: true,
          plan: true,
          subscriptionStatus: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          bankAccountName: true,
          bankSortCode: true,
          bankAccountNumber: true,
          tradingAddress: true,
          vatRegistered: true,
          vatNumber: true,
          cisStatus: true,
          cisUtr: true,
          customers: true,
          enquiries: {
            select: {
              customerName: true,
              contact: true,
              postcode: true,
              jobDescription: true,
              source: true,
              createdAt: true,
            },
          },
          quotes: { include: { lines: true, events: true } },
          invoices: { include: { events: true } },
          jobs: {
            include: {
              photos: { select: { id: true, filename: true, kind: true, createdAt: true, showOnWebsite: true } },
            },
          },
          priceItems: true,
          checklist: true,
          expenses: {
            select: {
              supplier: true,
              description: true,
              spentOn: true,
              totalPence: true,
              vatPence: true,
              category: true,
              status: true,
              source: true,
              confirmedAt: true,
              createdAt: true,
              jobId: true,
              customerId: true,
            },
          },
        },
      },
    },
  });
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), account }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="quotestick-export.json"',
    },
  });
}
