import { CIS_STATEMENT_NOTE } from "./calc";

export type StatementInvoice = {
  id: string;
  number: string;
  customerName: string;
  issuedAt: Date;
  labourPence: number;
  materialsPence: number;
  netPence: number;
  vatPence: number;
  totalPence: number;
  cisRate: number;
  cisDeductionPence: number;
  amountDuePence: number;
  status: string;
};

export type StatementTotals = {
  count: number;
  labourPence: number;
  materialsPence: number;
  netPence: number;
  vatPence: number;
  totalPence: number;
  cisDeductionPence: number;
  amountDuePence: number;
};

export type TaxYear = {
  startYear: number;
  start: Date;
  end: Date;
  label: string;
};

export function taxYearContaining(date: Date): TaxYear {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const startYear = month > 3 || (month === 3 && day >= 6) ? year : year - 1;
  return taxYearBounds(startYear);
}

export function taxYearBounds(startYear: number): TaxYear {
  const endYear = startYear + 1;
  return {
    startYear,
    start: new Date(Date.UTC(startYear, 3, 6)),
    end: new Date(Date.UTC(endYear, 3, 5, 23, 59, 59, 999)),
    label: `${startYear}/${String(endYear % 100).padStart(2, "0")}`,
  };
}

export function taxYearChoices(now: Date): number[] {
  const current = taxYearContaining(now).startYear;
  return [current, current - 1, current - 2];
}

export function parseTaxYear(value: string | undefined, now: Date): TaxYear {
  if (value && /^\d{4}$/.test(value)) {
    const startYear = Number(value);
    if (startYear >= 2000 && startYear <= 2100) return taxYearBounds(startYear);
  }
  return taxYearContaining(now);
}

export function sumStatement(rows: StatementInvoice[]): StatementTotals {
  const totals: StatementTotals = {
    count: rows.length,
    labourPence: 0,
    materialsPence: 0,
    netPence: 0,
    vatPence: 0,
    totalPence: 0,
    cisDeductionPence: 0,
    amountDuePence: 0,
  };
  for (const row of rows) {
    totals.labourPence += row.labourPence;
    totals.materialsPence += row.materialsPence;
    totals.netPence += row.netPence;
    totals.vatPence += row.vatPence;
    totals.totalPence += row.totalPence;
    totals.cisDeductionPence += row.cisDeductionPence;
    totals.amountDuePence += row.amountDuePence;
  }
  return totals;
}

export function statementMonthKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export function statementMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export type StatementMonth = { key: string; label: string; rows: StatementInvoice[]; totals: StatementTotals };

export function groupStatement(rows: StatementInvoice[]): StatementMonth[] {
  const ordered = [...rows].sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime() || a.number.localeCompare(b.number));
  const groups: StatementMonth[] = [];
  for (const row of ordered) {
    const key = statementMonthKey(row.issuedAt);
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label: statementMonthLabel(key), rows: [], totals: sumStatement([]) };
      groups.push(group);
    }
    group.rows.push(row);
    group.totals = sumStatement(group.rows);
  }
  return groups;
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function pounds(pence: number): string {
  return (pence / 100).toFixed(2);
}

export function statementCsv(input: {
  businessName: string;
  utr: string;
  taxYearLabel: string;
  rows: StatementInvoice[];
}): string {
  const totals = sumStatement(input.rows);
  const lines = [
    ["Field", "Value"].map(csvCell).join(","),
    ["Business", input.businessName].map(csvCell).join(","),
    ["Tax year", input.taxYearLabel].map(csvCell).join(","),
    ["UTR", input.utr || ""].map(csvCell).join(","),
    ["Note", CIS_STATEMENT_NOTE].map(csvCell).join(","),
    "",
    ["Invoice", "Customer", "Issued", "Labour", "Materials", "Net", "VAT", "Gross", "CIS rate", "CIS deduction", "Amount payable to you", "Status"]
      .map(csvCell)
      .join(","),
  ];
  const ordered = [...input.rows].sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime() || a.number.localeCompare(b.number));
  for (const row of ordered) {
    lines.push(
      [
        row.number,
        row.customerName,
        row.issuedAt.toISOString().slice(0, 10),
        pounds(row.labourPence),
        pounds(row.materialsPence),
        pounds(row.netPence),
        pounds(row.vatPence),
        pounds(row.totalPence),
        `${row.cisRate}%`,
        pounds(row.cisDeductionPence),
        pounds(row.amountDuePence),
        row.status.toLowerCase(),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push(
    [
      "Totals",
      "",
      "",
      pounds(totals.labourPence),
      pounds(totals.materialsPence),
      pounds(totals.netPence),
      pounds(totals.vatPence),
      pounds(totals.totalPence),
      "",
      pounds(totals.cisDeductionPence),
      pounds(totals.amountDuePence),
      String(totals.count),
    ]
      .map(csvCell)
      .join(","),
  );
  return `${lines.join("\n")}\n`;
}
