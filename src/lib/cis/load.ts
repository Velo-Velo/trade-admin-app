import { prisma } from "@/lib/db";
import { parseTaxYear, type StatementInvoice, type TaxYear } from "./statement";

export async function loadCisStatement(traderId: string, year: string | undefined, now = new Date()): Promise<{
  taxYear: TaxYear;
  rows: StatementInvoice[];
}> {
  const taxYear = parseTaxYear(year, now);
  const invoices = await prisma.invoice.findMany({
    where: {
      traderId,
      cisApplies: true,
      status: { in: ["SENT", "PAID"] },
      createdAt: { gte: taxYear.start, lte: taxYear.end },
    },
    orderBy: { createdAt: "asc" },
  });
  return {
    taxYear,
    rows: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      customerName: invoice.customerName,
      issuedAt: invoice.createdAt,
      labourPence: invoice.labourPence,
      materialsPence: invoice.materialsPence,
      netPence: invoice.netPence,
      vatPence: invoice.vatPence,
      totalPence: invoice.totalPence,
      cisRate: invoice.cisRate,
      cisDeductionPence: invoice.cisDeductionPence,
      amountDuePence: invoice.amountDuePence,
      status: invoice.status,
    })),
  };
}
