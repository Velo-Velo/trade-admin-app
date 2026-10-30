export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="grid gap-4 leading-7">
      <h1 className="font-serif text-4xl tracking-tight">Terms</h1>
      <p>Quotestick is a working name for software that helps a UK trade business publish a page, prepare quotes and send invoices. Creating an account does not take a card. Choosing Solo or Pro opens Stripe Billing, and a card is charged only there. The monthly amounts are shown as £14 and £24. Whether VAT is included is still to be confirmed. Quotestick does not give tax advice.</p>
      <p>You are responsible for the prices, the bank details, the VAT treatment and any registration numbers you publish. Quotestick does not check registers, and it does not give legal or tax advice. The cancellation notice on a domestic quote is a placeholder marked for legal review. A receipt you send in is a record for you and your accountant. Quotestick does not file it with HMRC. The VAT figure is only what the receipt shows, or what you type.</p>
      <p>A RAMS prepared in Quotestick is a draft for you to check. You are responsible for making sure it suits the site. It is not health and safety advice, and it is not sent to a client until you send it yourself.</p>
      <p>A quote stays a draft until you approve it. Do not share a draft link and expect the customer to open it. They will see a missing page.</p>
      <p>These terms are a plain description of how the product behaves. They are not a contract drafted by a solicitor.</p>
    </article>
  );
}
