import type { TradeValue } from "@/lib/trades";

export type ChecklistTemplate = {
  key: string;
  title: string;
  detail: string;
  officialUrl: string;
  verifyUrl: string;
  trades: Array<TradeValue | "ALL">;
  badgeLabel: string;
  publicRegister: boolean;
  reminderDays: number;
  sortOrder: number;
};

export const CHECKLIST: ChecklistTemplate[] = [
  {
    key: "hmrc-self-assessment",
    title: "Register for Self Assessment",
    detail:
      "Register with HMRC if you earn more than £1,000 from self-employment in a tax year. The usual deadline is 5 October after that tax year. Late registration can mean a penalty. The set-up guide is at https://www.gov.uk/set-up-sole-trader.",
    officialUrl: "https://www.gov.uk/register-for-self-assessment/self-employed",
    verifyUrl: "https://www.gov.uk/register-for-self-assessment/self-employed",
    trades: ["ALL"],
    badgeLabel: "",
    publicRegister: false,
    reminderDays: 30,
    sortOrder: 10,
  },
  {
    key: "business-records",
    title: "Keep business records",
    detail:
      "Keep invoices, receipts and a record of income and costs from day one. You will need them for Self Assessment and, if it applies, Making Tax Digital.",
    officialUrl: "https://www.gov.uk/self-employed-records",
    verifyUrl: "https://www.gov.uk/self-employed-records",
    trades: ["ALL"],
    badgeLabel: "",
    publicRegister: false,
    reminderDays: 30,
    sortOrder: 20,
  },
  {
    key: "public-liability",
    title: "Public liability insurance",
    detail:
      "Public liability insurance is not a legal requirement for a sole trader with no employees, but customers and competent-person schemes often ask for it. This app does not sell insurance. The link is HMRC and government guidance on business insurance, not an insurer.",
    officialUrl: "https://www.gov.uk/browse/business/insurance",
    verifyUrl: "https://www.gov.uk/browse/business/insurance",
    trades: ["ALL"],
    badgeLabel: "Public liability insurance",
    publicRegister: false,
    reminderDays: 30,
    sortOrder: 30,
  },
  {
    key: "employers-liability",
    title: "Employers' liability insurance",
    detail:
      "If you employ anyone, you usually need employers' liability insurance of at least £5 million. There is a limited exemption for some family employees. Fines apply if you need it and do not have it. Skip this if you do not employ anyone.",
    officialUrl: "https://www.gov.uk/employers-liability-insurance",
    verifyUrl: "https://www.gov.uk/employers-liability-insurance",
    trades: ["ALL"],
    badgeLabel: "",
    publicRegister: false,
    reminderDays: 30,
    sortOrder: 40,
  },
  {
    key: "vat-threshold",
    title: "VAT registration threshold",
    detail:
      "You must register for VAT if your taxable turnover goes over the threshold in a rolling 12 months, or you expect it to within the next 30 days. Check the linked page for the current threshold before you rely on a figure you remember.",
    officialUrl: "https://www.gov.uk/vat-registration/when-to-register",
    verifyUrl: "https://www.gov.uk/vat-registration/when-to-register",
    trades: ["ALL"],
    badgeLabel: "",
    publicRegister: false,
    reminderDays: 30,
    sortOrder: 50,
  },
  {
    key: "mtd-income-tax",
    title: "Making Tax Digital for Income Tax",
    detail:
      "Making Tax Digital for Income Tax applies by income band. From 6 April 2026 it covers sole traders and landlords with qualifying income over £50,000, with lower bands in later years. Check the official page for the date that applies to you. This app does not file returns.",
    officialUrl: "https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax",
    verifyUrl: "https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax",
    trades: ["ALL"],
    badgeLabel: "",
    publicRegister: false,
    reminderDays: 45,
    sortOrder: 60,
  },
  {
    key: "cis",
    title: "Construction Industry Scheme (CIS)",
    detail:
      "If you work for a contractor in construction, register as a CIS subcontractor. If you are not registered, the contractor deducts 30%. Registered subcontractors are usually deducted 20% unless they have gross payment status.",
    officialUrl: "https://www.gov.uk/what-you-must-do-as-a-cis-subcontractor",
    verifyUrl: "https://www.gov.uk/what-you-must-do-as-a-cis-subcontractor",
    trades: ["ALL"],
    badgeLabel: "",
    publicRegister: false,
    reminderDays: 30,
    sortOrder: 70,
  },
  {
    key: "waste-carrier",
    title: "Waste carrier registration",
    detail:
      "Register if you transport, buy, sell or dispose of waste. Carrying waste you produce yourself is often a different tier from carrying other people's waste. Check which tier applies before you assume it is free.",
    officialUrl: "https://www.gov.uk/waste-carrier-or-broker-registration",
    verifyUrl: "https://www.gov.uk/waste-carrier-or-broker-registration",
    trades: ["ALL"],
    badgeLabel: "Waste carrier",
    publicRegister: true,
    reminderDays: 45,
    sortOrder: 80,
  },
  {
    key: "gas-safe",
    title: "Gas Safe registration",
    detail:
      "You must be on the Gas Safe Register to carry out gas work. If you do not do gas work, mark this as not applicable. Customers can look up an engineer on the Gas Safe Register; Quotestick does not check it for you.",
    officialUrl: "https://www.gov.uk/find-licences/registration-to-carry-out-gas-work",
    verifyUrl: "https://www.gassaferegister.co.uk/",
    trades: ["PLUMBING_HEATING"],
    badgeLabel: "Gas Safe",
    publicRegister: true,
    reminderDays: 45,
    sortOrder: 90,
  },
  {
    key: "competent-person-plumbing",
    title: "Competent person scheme (plumbing and heating)",
    detail:
      "Some plumbing and heating work is notifiable under the building regulations. A competent person scheme lets you self-certify that work. The official list of schemes is on GOV.UK. Mark this not applicable if you do not do notifiable work.",
    officialUrl: "https://www.gov.uk/guidance/competent-person-scheme-current-schemes-and-how-schemes-are-authorised",
    verifyUrl: "https://www.gov.uk/guidance/competent-person-scheme-current-schemes-and-how-schemes-are-authorised",
    trades: ["PLUMBING_HEATING"],
    badgeLabel: "Competent person scheme",
    publicRegister: true,
    reminderDays: 45,
    sortOrder: 100,
  },
  {
    key: "competent-person-electrical",
    title: "Competent person scheme (electrical)",
    detail:
      "Notifiable electrical work in homes is usually done by someone registered with a competent person scheme such as NICEIC or NAPIT, or it is notified to building control. This app does not issue certificates.",
    officialUrl: "https://www.gov.uk/guidance/competent-person-scheme-current-schemes-and-how-schemes-are-authorised",
    verifyUrl: "https://www.gov.uk/guidance/competent-person-scheme-current-schemes-and-how-schemes-are-authorised",
    trades: ["ELECTRICAL"],
    badgeLabel: "Competent person scheme",
    publicRegister: true,
    reminderDays: 45,
    sortOrder: 110,
  },
  {
    key: "cscs",
    title: "CSCS card",
    detail:
      "Many construction sites ask for a CSCS card before you can work on site. It is not a general licence to trade. The official scheme site is cscs.uk.com rather than GOV.UK. Mark this not applicable if your sites do not ask for it.",
    officialUrl: "https://www.cscs.uk.com/",
    verifyUrl: "https://www.cscs.uk.com/",
    trades: ["BUILDING", "GENERAL"],
    badgeLabel: "CSCS",
    publicRegister: true,
    reminderDays: 45,
    sortOrder: 120,
  },
];

export function checklistForTrade(trade: TradeValue): ChecklistTemplate[] {
  return CHECKLIST.filter((item) => item.trades.includes("ALL") || item.trades.includes(trade)).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function checklistItemApplies(key: string, trade: TradeValue): boolean {
  const item = CHECKLIST.find((entry) => entry.key === key);
  if (!item) return true;
  return item.trades.includes("ALL") || item.trades.includes(trade);
}

export type BadgeItem = {
  status: string;
  showOnWebsite: boolean;
  badgeLabel: string;
  referenceNumber: string;
  verifyUrl: string;
  publicRegister: boolean;
};

export type WebsiteBadge = {
  label: string;
  reference: string;
  verifyUrl: string;
  publicRegister: boolean;
};

export function badgesForWebsite(items: BadgeItem[]): WebsiteBadge[] {
  return items
    .filter(
      (item) =>
        item.status === "DONE" &&
        item.showOnWebsite &&
        item.badgeLabel.trim().length > 0 &&
        item.referenceNumber.trim().length > 0,
    )
    .map((item) => ({
      label: item.badgeLabel,
      reference: item.referenceNumber.trim(),
      verifyUrl: item.verifyUrl,
      publicRegister: item.publicRegister,
    }));
}

export function checklistProgress(items: Array<{ status: string }>): {
  done: number;
  total: number;
  percent: number;
} {
  const applicable = items.filter((item) => item.status !== "NOT_APPLICABLE");
  const done = applicable.filter((item) => item.status === "DONE").length;
  const total = applicable.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}
