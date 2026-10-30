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
      "RAMS drafts, and company documents you store yourself",
      "Receipt photos from WhatsApp, for you to check. A record for you and your accountant, not a tax return",
      "Nothing is sent until you approve",
    ],
  },
  {
    name: "Solo",
    price: "£14",
    period: "a month",
    points: [
      "Everything in Free",
      "Invoices, PDFs and payment reminders",
      "WhatsApp drafts for a quote, an invoice or a RAMS. Receipt photos stay on Free",
      "Jobs you add yourself, and up to 150 job photos",
      "A diary of booked visits. Service dates show separately and do not book the job",
      "Card payments to your own Stripe account",
      "Quote follow-ups, service reminders and review requests",
      "Up to 40 invoices in a calendar month",
    ],
  },
  {
    name: "Pro",
    price: "£24",
    period: "a month",
    points: [
      "Everything in Solo, without the monthly invoice cap or the photo cap",
      "Last-paid prices from Splitstick, when that connection is switched on",
      "CIS deductions on invoices, on the labour only, and a statement for your accountant. Not filed with HMRC",
      "For a busier book of work. This version does not add extra logins for a crew",
    ],
  },
] as const;

export const PRICING_NOTE =
  "Creating an account does not charge a card. You are charged only after Stripe Billing is switched on and you choose Solo or Pro. The prices are shown as £14 and £24 a month. Whether VAT is added is still for the owner to confirm. Quotestick does not give tax advice.";

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
    a: "Free covers the website, the checklist, enquiries, quotes you approve, the customers on those quotes, the booked job when a quote is accepted, RAMS, and receipt photos on WhatsApp. Solo adds invoices, WhatsApp drafts, jobs you add yourself, photos, a diary, reminders and card payments, with a monthly cap. Pro removes that cap, adds Splitstick last-paid prices, and adds CIS deduction records. Those figures are for you and your accountant. They are not filed with HMRC. Prices are shown as £14 and £24 a month. Whether VAT is added is still to be confirmed.",
  },
  {
    q: "Does Quotestick file CIS or a tax return?",
    a: "No. On Pro you can record a CIS deduction on an invoice. It is a percentage of the labour, not the materials or the VAT. You can download a statement for your accountant. Quotestick does not send it to HMRC and it does not give tax advice.",
  },
] as const;
