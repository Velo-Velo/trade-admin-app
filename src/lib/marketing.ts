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
      "Draft quotes by email. Nothing is sent until you approve",
    ],
  },
  {
    name: "Workshop",
    price: "£11.99",
    period: "a month",
    points: [
      "WhatsApp in, a draft quote or invoice out",
      "Numbered invoice PDFs, bank details and card links",
      "Payment reminders, quote follow-ups and service reminders",
      "Job board, customer book and job photos",
    ],
  },
  {
    name: "With Splitstick",
    price: "£14.99",
    period: "a month",
    points: [
      "Everything in Workshop",
      "Last-paid prices from Splitstick receipts, when that connection is switched on",
      "The price book still waits for you. A receipt does not send a quote",
    ],
  },
] as const;

export const PRICING_NOTE =
  "Creating an account does not take a card. These are the prices. This build does not charge them yet.";

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
    a: "The free account is the website, the checklist and quotes you approve. WhatsApp, invoices, the job board and Splitstick are on the paid prices above.",
  },
] as const;
