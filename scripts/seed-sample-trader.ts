import { randomBytes } from "node:crypto";
import type { PrismaClient, QuoteStatus } from "@prisma/client";
import {
  DEMO_BUSINESS_NAME,
  DEMO_EMAIL,
  DEMO_ENQUIRIES,
  DEMO_PRICE_BOOK,
  DEMO_SLUG,
  DEMO_TRADER,
  demoChecklistSeed,
} from "../src/lib/demo";
import { coolingOffFor } from "../src/lib/quotes/cooling-off";
import { buildDraftQuote, describeDraft } from "../src/lib/quotes/draft";
import { PLUMBING_TEMPLATES } from "../src/lib/templates/plumbing";
import { seedJobTemplates } from "../src/lib/templates/seed-job-templates";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysAhead(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function token(): string {
  return randomBytes(32).toString("base64url");
}

/** Creates the fictional trader, or replaces that account's data. Other traders are left alone. */
export async function seedSampleTrader(prisma: PrismaClient): Promise<void> {
  const templates = await seedJobTemplates(prisma);
  const slugOwner = await prisma.trader.findUnique({
    where: { slug: DEMO_SLUG },
    include: { user: true },
  });
  if (slugOwner && slugOwner.user.email !== DEMO_EMAIL) {
    throw new Error(
      `The public address /t/${DEMO_SLUG} is already used by ${slugOwner.user.email}. The sample trader was not changed.`,
    );
  }

  const templatesForDraft = PLUMBING_TEMPLATES.map((template) => ({
    trade: template.trade,
    slug: template.slug,
    name: template.name,
    keywords: template.keywords,
    lines: template.lines,
  }));

  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: DEMO_EMAIL },
      include: { trader: true },
    });
    if (existing?.trader) {
      await tx.quote.deleteMany({ where: { traderId: existing.trader.id } });
      await tx.enquiry.deleteMany({ where: { traderId: existing.trader.id } });
      await tx.priceBookItem.deleteMany({ where: { traderId: existing.trader.id } });
      await tx.checklistItem.deleteMany({ where: { traderId: existing.trader.id } });
      await tx.trader.delete({ where: { id: existing.trader.id } });
    }

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { passwordHash: null },
        })
      : await tx.user.create({
          data: { email: DEMO_EMAIL, passwordHash: null },
        });

    const trader = await tx.trader.create({
      data: {
        userId: user.id,
        businessName: DEMO_TRADER.businessName,
        slug: DEMO_TRADER.slug,
        trade: DEMO_TRADER.trade,
        area: DEMO_TRADER.area,
        postcodes: DEMO_TRADER.postcodes,
        phone: DEMO_TRADER.phone,
        logoText: DEMO_TRADER.logoText,
        brandColour: DEMO_TRADER.brandColour,
        services: DEMO_TRADER.services,
        bio: DEMO_TRADER.bio,
        quoteSeq: 0,
      },
    });

    const priceRows = [];
    for (const row of DEMO_PRICE_BOOK) {
      priceRows.push(
        await tx.priceBookItem.create({
          data: {
            traderId: trader.id,
            kind: row.kind,
            description: row.description,
            unit: row.unit,
            sellPricePence: row.sellPricePence,
            lastPaidPence: row.lastPaidPence,
            lastPaidAt: row.lastPaidPence === null ? null : daysAgo(12),
            source: "MANUAL",
            merchant: row.merchant,
          },
        }),
      );
    }

    const priceBook = priceRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      description: row.description,
      sellPricePence: row.sellPricePence,
      lastPaidPence: row.lastPaidPence,
    }));

    for (const enquiryInput of DEMO_ENQUIRIES) {
      const draft = await buildDraftQuote({
        trade: "PLUMBING_HEATING",
        jobDescription: enquiryInput.jobDescription,
        templates: templatesForDraft,
        priceBook,
        completer: null,
      });
      const updated = await tx.trader.update({
        where: { id: trader.id },
        data: { quoteSeq: { increment: 1 } },
      });
      const number = `Q-${String(updated.quoteSeq).padStart(4, "0")}`;
      const createdAt = daysAgo(enquiryInput.daysAgo);
      const enquiry = await tx.enquiry.create({
        data: {
          traderId: trader.id,
          customerName: enquiryInput.customerName,
          contact: enquiryInput.contact,
          postcode: enquiryInput.postcode,
          jobDescription: enquiryInput.jobDescription,
          source: "website",
          createdAt,
        },
      });

      const status = enquiryInput.status as QuoteStatus;
      const approvedAt = status === "DRAFT" ? null : daysAgo(Math.max(enquiryInput.daysAgo - 1, 0));
      const acceptedAt = status === "ACCEPTED" ? daysAgo(Math.max(enquiryInput.daysAgo - 2, 0)) : null;
      const hasEmail = enquiryInput.contact.includes("@");
      await tx.quote.create({
        data: {
          traderId: trader.id,
          enquiryId: enquiry.id,
          number,
          status,
          customerName: enquiryInput.customerName,
          customerContact: enquiryInput.contact,
          postcode: enquiryInput.postcode,
          jobDescription: enquiryInput.jobDescription,
          publicToken: token(),
          domestic: true,
          depositPercent: 30,
          coolingOffText: coolingOffFor(true),
          draftNote: describeDraft(draft),
          approvedAt,
          sentAt: approvedAt,
          acceptedAt,
          createdAt,
          lines: {
            create: draft.lines.map((line, index) => ({
              kind: line.kind,
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
              unitPricePence: line.unitPricePence,
              priceBookItemId: line.priceBookItemId ?? null,
              lastPaidPence: line.lastPaidPence ?? null,
              sortOrder: index,
            })),
          },
          events: {
            create: [
              {
                type: "draft_created",
                channel: "web",
                detail: "Draft created from sample data. Not sent to a real customer.",
                createdAt,
              },
              ...(approvedAt
                ? [
                    {
                      type: "approved",
                      channel: hasEmail ? "email" : "web",
                      detail: hasEmail
                        ? "Approved. The customer link is live. Email was logged, not sent (no SMTP configured)."
                        : "Approved. No email address on the enquiry, so nothing was emailed. Share the link yourself. WhatsApp is not connected.",
                      createdAt: approvedAt,
                    },
                  ]
                : []),
              ...(acceptedAt
                ? [
                    {
                      type: "customer_accepted",
                      channel: "web",
                      detail: "Customer accepted on the public quote page. Sample data.",
                      createdAt: acceptedAt,
                    },
                  ]
                : []),
            ],
          },
        },
      });
      if (draft.templateSlug === null) {
        throw new Error(`Sample enquiry did not match a template: ${number}`);
      }
    }

    for (const item of demoChecklistSeed()) {
      await tx.checklistItem.create({
        data: {
          traderId: trader.id,
          key: item.key,
          title: item.title,
          detail: item.detail,
          officialUrl: item.officialUrl,
          verifyUrl: item.verifyUrl,
          badgeLabel: item.badgeLabel,
          publicRegister: item.publicRegister,
          reminderDays: item.reminderDays,
          sortOrder: item.sortOrder,
          status: item.status,
          referenceNumber: item.referenceNumber,
          showOnWebsite: item.showOnWebsite,
          expiresAt: item.expiresInDays === null ? null : daysAhead(item.expiresInDays),
        },
      });
    }
  });

  console.log(`Job templates ready (${templates}).`);
  console.log(`Sample trader reset: ${DEMO_BUSINESS_NAME} (${DEMO_EMAIL})`);
  console.log(`Public page: /t/${DEMO_SLUG}`);
}
