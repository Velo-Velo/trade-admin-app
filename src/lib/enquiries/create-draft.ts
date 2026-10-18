import type { Trade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { coolingOffFor } from "@/lib/quotes/cooling-off";
import { buildDraftQuote, describeDraft, type TemplateInput } from "@/lib/quotes/draft";
import { completerFromEnv } from "@/lib/quotes/llm";
import { newToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { customerEmail } from "@/lib/format";

export async function createEnquiryAndDraft(input: {
  traderId: string;
  customerName: string;
  contact: string;
  postcode: string;
  jobDescription: string;
  source: "website" | "manual";
  photos: Array<{ filename: string; mimeType: string; bytes: Uint8Array<ArrayBuffer> }>;
  origin: string;
}): Promise<{ enquiryId: string; quoteId: string; number: string }> {
  const trader = await prisma.trader.findUniqueOrThrow({
    where: { id: input.traderId },
    include: { user: true, priceItems: true },
  });
  const templateRows = await prisma.jobTemplate.findMany({
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  const templates: TemplateInput[] = templateRows.map((template) => ({
    trade: template.trade,
    slug: template.slug,
    name: template.name,
    keywords: template.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
    lines: template.lines.map((line) => ({
      kind: line.kind,
      description: line.description,
      quantity: Number(line.quantity),
      unit: line.unit,
      unitPricePence: line.starterPricePence,
    })),
  }));

  const draft = await buildDraftQuote({
    trade: trader.trade as Trade,
    jobDescription: input.jobDescription,
    templates,
    priceBook: trader.priceItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      description: item.description,
      sellPricePence: item.sellPricePence,
      lastPaidPence: item.lastPaidPence,
    })),
    completer: completerFromEnv(),
  });

  const created = await prisma.$transaction(async (tx) => {
    const updated = await tx.trader.update({
      where: { id: trader.id },
      data: { quoteSeq: { increment: 1 } },
    });
    const number = `Q-${String(updated.quoteSeq).padStart(4, "0")}`;
    const enquiry = await tx.enquiry.create({
      data: {
        traderId: trader.id,
        customerName: input.customerName,
        contact: input.contact,
        postcode: input.postcode,
        jobDescription: input.jobDescription,
        source: input.source,
        photos: {
          create: input.photos.map((photo) => ({
            filename: photo.filename,
            mimeType: photo.mimeType,
            bytes: photo.bytes,
          })),
        },
      },
    });
    const quote = await tx.quote.create({
      data: {
        traderId: trader.id,
        enquiryId: enquiry.id,
        number,
        status: "DRAFT",
        customerName: input.customerName,
        customerContact: input.contact,
        postcode: input.postcode,
        jobDescription: input.jobDescription,
        publicToken: newToken(),
        domestic: true,
        depositPercent: 30,
        coolingOffText: coolingOffFor(true),
        draftNote: describeDraft(draft),
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
          create: {
            type: "draft_created",
            channel: input.source === "website" ? "web" : "manual",
            detail: "Draft created. Not sent to the customer.",
          },
        },
      },
    });
    return { enquiryId: enquiry.id, quoteId: quote.id, number };
  });

  const traderEmail = customerEmail(trader.user.email);
  if (traderEmail) {
    await sendEmail({
      to: traderEmail,
      subject: `New enquiry from ${input.customerName}`,
      text: [
        `${input.customerName} (${input.postcode}) sent an enquiry.`,
        "",
        input.jobDescription,
        "",
        `A draft quote ${created.number} is waiting for your approval.`,
        "Nothing has been sent to the customer.",
        "",
        `${input.origin}/quotes/${created.quoteId}`,
      ].join("\n"),
    });
  }

  return created;
}
