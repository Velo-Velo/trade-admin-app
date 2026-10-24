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
    q: "What is included before I pay?",
    a: "Free covers the website, the checklist, enquiries, quotes you approve, the customers on those quotes, and the booked job when a quote is accepted. Trade adds invoices, WhatsApp, photos, reminders and card payments. The Splitstick bundle adds receipt prices.",
  },
] as const;
