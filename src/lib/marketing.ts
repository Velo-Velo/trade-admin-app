export const HERO = {
  kicker: "For UK trades",
  title: "Send a quote from the van.",
  lede: "Get paid before you leave the drive. The customer sees the quote only after you have checked the lines and tapped approve.",
};

export const PLANS = [
  {
    name: "Free",
    price: "£0",
    period: "",
    points: [
      "A one-page website with your name, trade and area",
      "A start-up checklist, with badges only if you choose to show them",
      "Enquiries, draft quotes, and the booked job when a customer accepts",
      "Receipt photos from WhatsApp, for you to check. A record for you and your accountant, not a tax return",
      "Nothing is sent until you approve",
    ],
  },
  {
    name: "Trade",
    price: "£11.99",
    period: "a month",
    points: [
      "Invoices, PDFs and payment reminders",
      "WhatsApp in, a draft quote or invoice out",
      "Job photos, quote follow-ups and service reminders",
      "A diary of booked visits. Service dates show separately and do not book the job",
      "Card payments to your own Stripe account",
    ],
  },
  {
    name: "Splitstick bundle",
    price: "£16.99",
    period: "a month",
    points: [
      "Everything in Trade",
      "Last-paid prices from Splitstick receipts, when that connection is switched on",
      "CIS deductions on invoices, on the labour only, and a statement for your accountant. Not filed with HMRC",
      "The price book still waits for you. A receipt does not send a quote",
    ],
  },
] as const;

export const PRICING_NOTE =
  "Creating an account does not charge a card. You are charged only after Stripe Billing is switched on and you choose Trade or the Splitstick bundle.";

export const FAQ = [
  {
    q: "Does the customer see a price straight away?",
    a: "No. An enquiry becomes a draft. You edit the lines, then approve. Until then the public link does not open.",
  },
  {
    q: "Can I do this from the van?",
    a: "Yes. The page works on a phone. If you link WhatsApp, a text or a voice note can start a draft too. You still tap approve.",
  },
  {
    q: "What if I am not VAT registered?",
    a: "No VAT is added unless you say you are VAT registered and enter a VAT number. A quick invoice treats the figure as the customer total.",
  },
  {
    q: "Does the checklist prove I am on a register?",
    a: "No. A badge appears only when you mark an item done, enter a number, and choose to show it. Quotestick does not check Gas Safe, the water regulations or any other register.",
  },
  {
    q: "Can I write a RAMS in the app?",
    a: "Yes. Start from a job you already have. The draft comes from a checked hazard library for the trade. You edit it and download a PDF. You check that it suits the site. It is a drafting aid, not health and safety advice, and it is not sent until you send it.",
  },
  {
    q: "What is included before I pay?",
    a: "Free covers the website, the checklist, enquiries, quotes you approve, the customers on those quotes, the booked job when a quote is accepted, and receipt photos on WhatsApp. Trade adds invoices, draft quotes and invoices on WhatsApp, photos, reminders, card payments and a diary of visits. The Splitstick bundle adds receipt prices and CIS deduction records. Those figures are for you and your accountant. They are not filed with HMRC.",
  },
  {
    q: "Does Quotestick file CIS or a tax return?",
    a: "No. On the Splitstick bundle you can record a CIS deduction on an invoice. It is a percentage of the labour, not the materials or the VAT. You can download a statement for your accountant. Quotestick does not send it to HMRC and it does not give tax advice.",
  },
] as const;
