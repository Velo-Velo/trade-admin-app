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
import { customerSearchText, normalisePhone } from "../src/lib/customers/match";
import { ensureBookedJob } from "../src/lib/jobs/ensure";
import { quoteChaseCopy, serviceChaseCopy } from "../src/lib/chasers/plan";
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

  const samplePhotos = await sampleJobPhotos();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: DEMO_EMAIL },
      include: { trader: true },
    });
    if (existing?.trader) {
      await tx.job.deleteMany({ where: { traderId: existing.trader.id } });
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
        invoiceSeq: 0,
        whatsappE164: "447700900100",
        bankAccountName: "Sample Harbour Heating",
        bankSortCode: "00-00-00",
        bankAccountNumber: "00000000",
        tradingAddress: "Sample address, United Kingdom",
        vatRegistered: false,
        googleReviewUrl: "https://example.com/sample-review",
        reviewChasersEnabled: true,
        siteTheme: "ink",
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

    const people = [
      { name: "Alex Sample", email: "alex.sample@example.com", phone: "", postcode: "SW1A 1AA", address: "2 Sample Close, London" },
      { name: "Priya Sample", email: "", phone: "07700 900201", postcode: "M1 1AE", address: "" },
      { name: "Jordan Sample", email: "jordan.sample@example.com", phone: "07700 900401", postcode: "EH1 1AA", address: "4 Sample Crescent, Edinburgh" },
      { name: "Sam Sample", email: "sam.sample@example.com", phone: "", postcode: "CF10 1AA", address: "18 Sample Lane, Cardiff" },
      { name: "Mrs Jones Sample", email: "mrs.jones.sample@example.com", phone: "", postcode: "LS1 1AA", address: "8 Sample Road, Leeds" },
      { name: "Riley Sample", email: "", phone: "07700 900301", postcode: "BS1 4ST", address: "14 Sample Street, Bristol" },
    ];
    const customers = new Map<string, { id: string }>();
    for (const person of people) {
      const phone = normalisePhone(person.phone);
      const customer = await tx.customer.create({
        data: {
          traderId: trader.id,
          name: person.name,
          email: person.email,
          phone,
          postcode: person.postcode,
          address: person.address,
          searchText: customerSearchText({ ...person, phone }),
        },
      });
      customers.set(person.name, customer);
    }

    let acceptedQuoteId = "";
    let jordanQuote: { id: string; number: string; publicToken: string; customerName: string } | null = null;
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
      const person = customers.get(enquiryInput.customerName);
      const enquiry = await tx.enquiry.create({
        data: {
          traderId: trader.id,
          customerId: person?.id,
          customerName: enquiryInput.customerName,
          contact: enquiryInput.contact,
          postcode: enquiryInput.postcode,
          jobDescription: enquiryInput.jobDescription,
          source: "website",
          createdAt,
          photos:
            enquiryInput.customerName === "Sam Sample"
              ? {
                  create: {
                    filename: "cistern-before.jpg",
                    mimeType: "image/jpeg",
                    bytes: samplePhotos.cistern,
                  },
                }
              : undefined,
        },
      });

      const status = enquiryInput.status as QuoteStatus;
      const approvedAt = status === "DRAFT" ? null : daysAgo(Math.max(enquiryInput.daysAgo - 1, 0));
      const acceptedAt = status === "ACCEPTED" ? daysAgo(Math.max(enquiryInput.daysAgo - 2, 0)) : null;
      const hasEmail = enquiryInput.contact.includes("@");
      const quote = await tx.quote.create({
        data: {
          traderId: trader.id,
          customerId: person?.id,
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
      if (status === "ACCEPTED") acceptedQuoteId = quote.id;
      if (enquiryInput.customerName === "Jordan Sample" && status === "SENT") {
        jordanQuote = {
          id: quote.id,
          number: quote.number,
          publicToken: quote.publicToken,
          customerName: quote.customerName,
        };
      }
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

    const unpaidDue = daysAgo(1);
    const unpaid = await tx.invoice.create({
      data: {
        traderId: trader.id,
        number: "I-0001",
        status: "SENT",
        customerId: customers.get("Mrs Jones Sample")?.id,
        customerName: "Mrs Jones Sample",
        customerContact: "mrs.jones.sample@example.com",
        description: "Replaced a kitchen tap. Sample invoice, not a real job.",
        netPence: 8000,
        vatPence: 0,
        totalPence: 8000,
        vatRate: 0,
        publicToken: token(),
        reviewToken: token(),
        dueAt: unpaidDue,
        chaserEnabled: true,
        chaserStage: 0,
        approvedAt: daysAgo(4),
        sentAt: daysAgo(4),
        createdAt: daysAgo(5),
        businessName: DEMO_TRADER.businessName,
        phone: DEMO_TRADER.phone,
        tradingAddress: "Sample address, United Kingdom",
        bankAccountName: "Sample Harbour Heating",
        bankSortCode: "00-00-00",
        bankAccountNumber: "00000000",
        source: "whatsapp",
        events: {
          create: [
            {
              type: "draft_created",
              channel: "whatsapp",
              detail: "Draft invoice from sample chat. Not sent to a real customer.",
              createdAt: daysAgo(5),
            },
            {
              type: "approved",
              channel: "email",
              detail: "Approved. Email was logged, not sent (sample data).",
              createdAt: daysAgo(4),
            },
          ],
        },
      },
    });
    const paidAt = daysAgo(3);
    const paid = await tx.invoice.create({
      data: {
        traderId: trader.id,
        number: "I-0002",
        status: "PAID",
        customerId: customers.get("Alex Sample")?.id,
        customerName: "Alex Sample",
        customerContact: "alex.sample@example.com",
        description: "Supply and fit a basin tap. Sample invoice, already paid.",
        netPence: 9500,
        vatPence: 0,
        totalPence: 9500,
        vatRate: 0,
        publicToken: token(),
        reviewToken: token(),
        dueAt: daysAgo(8),
        chaserEnabled: true,
        chaserStage: 1,
        paidAt,
        approvedAt: daysAgo(10),
        sentAt: daysAgo(10),
        jobCompletedAt: paidAt,
        reviewStage: 1,
        lastReviewAt: daysAgo(2),
        createdAt: daysAgo(12),
        businessName: DEMO_TRADER.businessName,
        phone: DEMO_TRADER.phone,
        tradingAddress: "Sample address, United Kingdom",
        bankAccountName: "Sample Harbour Heating",
        bankSortCode: "00-00-00",
        bankAccountNumber: "00000000",
        source: "dashboard",
        events: {
          create: [
            {
              type: "approved",
              channel: "email",
              detail: "Approved. Sample data.",
              createdAt: daysAgo(10),
            },
            {
              type: "chaser_sent",
              channel: "email",
              detail: "Reminder 1 logged, not emailed. Sample data.",
              createdAt: daysAgo(8),
            },
            {
              type: "paid",
              channel: "web",
              detail: "Marked paid. Payment reminders have stopped. Sample data.",
              createdAt: paidAt,
            },
            {
              type: "review_sent",
              channel: "email",
              detail: "Review note 1 logged, not emailed. Sample data.",
              createdAt: daysAgo(2),
            },
          ],
        },
      },
    });
    const draftInvoice = await tx.invoice.create({
      data: {
        traderId: trader.id,
        customerId: customers.get("Sam Sample")?.id,
        number: "I-0003",
        status: "DRAFT",
        customerName: "Sam Sample",
        customerContact: "sam.sample@example.com",
        description: "Supply and fit a basin tap. Sample draft, not sent.",
        netPence: 9500,
        vatPence: 0,
        totalPence: 9500,
        vatRate: 0,
        publicToken: token(),
        reviewToken: token(),
        dueAt: daysAhead(14),
        chaserEnabled: true,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        businessName: DEMO_TRADER.businessName,
        phone: DEMO_TRADER.phone,
        tradingAddress: "Sample address, United Kingdom",
        bankAccountName: "Sample Harbour Heating",
        bankSortCode: "00-00-00",
        bankAccountNumber: "00000000",
        source: "whatsapp",
        events: {
          create: {
            type: "draft_created",
            channel: "whatsapp",
            detail: "Draft invoice. Not sent to the customer.",
          },
        },
      },
    });
    await tx.trader.update({ where: { id: trader.id }, data: { invoiceSeq: 3 } });

    const booked = await ensureBookedJob(tx, acceptedQuoteId);
    if (!booked) throw new Error("The accepted sample quote did not create a booked job.");
    await tx.job.update({ where: { id: booked.id }, data: { invoiceId: draftInvoice.id } });
    await tx.jobPhoto.updateMany({ where: { jobId: booked.id }, data: { showOnWebsite: true } });

    const riley = customers.get("Riley Sample");
    const jones = customers.get("Mrs Jones Sample");
    const alex = customers.get("Alex Sample");
    if (!riley || !jones || !alex) throw new Error("Sample customers were not created.");

    await tx.job.create({
      data: {
        traderId: trader.id,
        customerId: riley.id,
        title: "Outside tap is dripping",
        address: "14 Sample Street, Bristol",
        postcode: "BS1 4ST",
        status: "IN_PROGRESS",
        bookedAt: daysAgo(4),
        startedAt: daysAgo(1),
        photos: {
          create: {
            kind: "BEFORE",
            filename: "outside-tap-before.jpg",
            mimeType: "image/jpeg",
            bytes: samplePhotos.outside,
            showOnWebsite: true,
          },
        },
      },
    });
    await tx.job.create({
      data: {
        traderId: trader.id,
        customerId: jones.id,
        invoiceId: unpaid.id,
        title: "Replaced a kitchen tap",
        address: "8 Sample Road, Leeds",
        postcode: "LS1 1AA",
        status: "DONE",
        bookedAt: daysAgo(7),
        startedAt: daysAgo(6),
        doneAt: daysAgo(4),
        photos: {
          create: [
            { kind: "BEFORE", filename: "kitchen-tap-before.jpg", mimeType: "image/jpeg", bytes: samplePhotos.beforeTap, showOnWebsite: true },
            { kind: "AFTER", filename: "kitchen-tap-after.jpg", mimeType: "image/jpeg", bytes: samplePhotos.afterTap, showOnWebsite: true },
          ],
        },
      },
    });
    await tx.job.create({
      data: {
        traderId: trader.id,
        customerId: alex.id,
        invoiceId: paid.id,
        title: "Supply and fit a basin tap",
        address: "2 Sample Close, London",
        postcode: "SW1A 1AA",
        status: "DONE",
        bookedAt: daysAgo(14),
        startedAt: daysAgo(12),
        doneAt: daysAgo(3),
        photos: {
          create: {
            kind: "AFTER",
            filename: "basin-tap-after.jpg",
            mimeType: "image/jpeg",
            bytes: samplePhotos.basin,
            showOnWebsite: true,
          },
        },
      },
    });
    const jordan = customers.get("Jordan Sample");
    if (!jordan || !jordanQuote) throw new Error("The unanswered sample quote was not created.");
    const origin = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const quoteCopy = quoteChaseCopy({
      stage: 0,
      businessName: DEMO_TRADER.businessName,
      number: jordanQuote.number,
      customerName: jordanQuote.customerName,
      quoteUrl: `${origin}/q/${jordanQuote.publicToken}`,
    });
    await tx.customerChase.create({
      data: {
        traderId: trader.id,
        kind: "QUOTE",
        status: "PENDING",
        quoteId: jordanQuote.id,
        stage: 0,
        subject: quoteCopy.subject,
        body: quoteCopy.text,
      },
    });
    const serviceDue = daysAhead(18);
    const boiler = await tx.job.create({
      data: {
        traderId: trader.id,
        customerId: jordan.id,
        title: "Annual boiler service",
        address: "4 Sample Crescent, Edinburgh",
        postcode: "EH1 1AA",
        status: "DONE",
        bookedAt: daysAgo(347),
        startedAt: daysAgo(347),
        doneAt: daysAgo(347),
        recurring: true,
        intervalMonths: 12,
        serviceDueAt: serviceDue,
      },
    });
    const serviceCopy = serviceChaseCopy({
      businessName: DEMO_TRADER.businessName,
      customerName: "Jordan Sample",
      title: "Annual boiler service",
      dueAt: serviceDue,
      bookingUrl: `${origin}/t/${DEMO_SLUG}`,
    });
    await tx.customerChase.create({
      data: {
        traderId: trader.id,
        kind: "SERVICE",
        status: "PENDING",
        jobId: boiler.id,
        stage: 0,
        subject: serviceCopy.subject,
        body: serviceCopy.text,
      },
    });

    const phone = "447700900100";
    await tx.whatsAppMessage.createMany({
      data: [
        {
          traderId: trader.id,
          phone,
          direction: "in",
          body: "Invoice Mrs Jones, replaced tap, £80",
          createdAt: daysAgo(5),
        },
        {
          traderId: trader.id,
          phone,
          direction: "out",
          body: `Draft invoice ${unpaid.number} for Mrs Jones Sample.\nReplaced a kitchen tap. £80.00.\nNothing has been sent to the customer.\nReply APPROVE ${unpaid.number} to send it.`,
          createdAt: daysAgo(5),
        },
      ],
    });
  }, { timeout: 20_000 });

  console.log(`Job templates ready (${templates}).`);
  console.log(`Sample trader reset: ${DEMO_BUSINESS_NAME} (${DEMO_EMAIL})`);
  console.log(`Public page: /t/${DEMO_SLUG}`);
}

async function sampleJobPhotos(): Promise<{
  cistern: Buffer;
  outside: Buffer;
  beforeTap: Buffer;
  afterTap: Buffer;
  basin: Buffer;
}> {
  const sharp = (await import("sharp")).default;
  async function card(red: number, green: number, blue: number, band: number): Promise<Buffer> {
    const base = await sharp({
      create: { width: 800, height: 500, channels: 3, background: { r: red, g: green, b: blue } },
    })
      .png()
      .toBuffer();
    const stripe = await sharp({
      create: { width: 800, height: 72, channels: 3, background: { r: band, g: band, b: band } },
    })
      .png()
      .toBuffer();
    return sharp(base).composite([{ input: stripe, top: 36, left: 0 }]).jpeg({ quality: 70 }).toBuffer();
  }
  const [cistern, outside, beforeTap, afterTap, basin] = await Promise.all([
    card(210, 196, 168, 90),
    card(168, 196, 184, 40),
    card(196, 168, 160, 70),
    card(176, 196, 170, 230),
    card(170, 186, 204, 30),
  ]);
  return { cistern, outside, beforeTap, afterTap, basin };
}
