import { prisma } from "@/lib/db";
import { photoBytes } from "@/lib/images/prepare";
import { sendWhatsAppText, whatsappConfigured } from "@/lib/whatsapp/client";
import { captureWhatsAppReceipt, traderForReceipt, type ReceiptImage, type ReceiptStore } from "@/lib/receipts/capture";
import { readerFromEnv, type ReceiptReader } from "@/lib/receipts/read";

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

export function prismaReceiptStore(): ReceiptStore {
  return {
    async claim(externalId) {
      try {
        await prisma.whatsAppReceipt.create({ data: { id: externalId } });
        return true;
      } catch (error) {
        if (isUniqueConflict(error)) return false;
        throw error;
      }
    },
    async findVerifiedTrader(phone) {
      const trader = await prisma.trader.findUnique({
        where: { whatsappE164: phone },
        include: { user: { select: { email: true } } },
      });
      const verified = traderForReceipt(trader);
      if (!verified) return null;
      return {
        id: verified.id,
        businessName: verified.businessName,
        slug: verified.slug,
        email: verified.user.email,
      };
    },
    async listJobs(traderId) {
      const jobs = await prisma.job.findMany({
        where: { traderId },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: {
          id: true,
          customerId: true,
          title: true,
          address: true,
          postcode: true,
          customer: { select: { name: true } },
        },
      });
      return jobs.map((job) => ({
        id: job.id,
        customerId: job.customerId,
        title: job.title,
        customerName: job.customer.name,
        address: job.address,
        postcode: job.postcode,
      }));
    },
    async createExpense(expense) {
      return prisma.expense.create({
        data: {
          traderId: expense.traderId,
          supplier: expense.supplier,
          description: expense.description,
          spentOn: expense.spentOn ? new Date(`${expense.spentOn}T00:00:00.000Z`) : null,
          totalPence: expense.totalPence,
          vatPence: expense.vatPence,
          category: expense.category,
          extractionNote: expense.extractionNote,
          imageFilename: expense.filename,
          imageMime: "image/jpeg",
          imageBytes: photoBytes(Buffer.from(expense.bytes)),
          source: "whatsapp",
          jobId: expense.jobId,
          customerId: expense.customerId,
          status: "NEEDS_REVIEW",
        },
        select: { id: true },
      });
    },
    async remember(row) {
      await prisma.whatsAppMessage.create({
        data: {
          phone: row.phone,
          traderId: row.traderId,
          direction: row.direction,
          body: row.body.slice(0, 4000),
        },
      });
    },
    async reply(row) {
      await prisma.whatsAppMessage.create({
        data: {
          phone: row.phone,
          traderId: row.traderId,
          direction: "out",
          body: row.text.slice(0, 4000),
        },
      });
      if (row.viaMeta && whatsappConfigured() && !row.sandbox) {
        try {
          await sendWhatsAppText(row.phone, row.text);
        } catch (error) {
          console.error("[whatsapp receipt]", error);
        }
      }
    },
  };
}

export async function ingestWhatsAppReceipt(input: {
  from: string;
  externalId: string;
  caption: string;
  viaMeta: boolean;
  image: ReceiptImage | null;
  prepareError: string | null;
  read?: ReceiptReader | null;
}): Promise<{ replies: string[]; expenseId: string | null }> {
  const origin = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const read = input.read === undefined ? readerFromEnv() : input.read;
  return captureWhatsAppReceipt(
    {
      from: input.from,
      externalId: input.externalId,
      caption: input.caption,
      viaMeta: input.viaMeta,
      image: input.image,
      prepareError: input.prepareError,
      origin,
      read,
    },
    prismaReceiptStore(),
  );
}
