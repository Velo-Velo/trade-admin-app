export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="grid gap-4 leading-7">
      <h1 className="font-serif text-4xl tracking-tight">Privacy</h1>
      <p>
        Quotestick stores what a trader types in, and what their customers send through the enquiry form, WhatsApp (when it is connected) and quote or invoice pages.
      </p>
      <p>That includes names, emails, phone numbers, addresses, job descriptions, prices, bank details the trader chooses to print, and photographs. Photographs are kept in the database. A job photo is private until the trader marks it to show on their page. A receipt photo sent on WhatsApp, or added in the app, is stored with the supplier, date, total and any VAT figure you confirm. It is a record for you and your accountant. It is not sent to HMRC.</p>
      <p>The session cookie keeps you signed in. Card payments, if switched on, are taken by Stripe on the trader&apos;s connected account. A Solo or Pro subscription, if you choose one, is also taken by Stripe on the Quotestick account. Quotestick stores the plan name and the Stripe customer id. It does not store the card number. Email, if switched on, is sent through the mail server the operator configured. Quotestick does not sell this data.</p>
      <p>This note describes the product. It is not a privacy policy drafted by a solicitor, and this build does not publish a company number or a postal address. To ask for a copy or deletion, use the email address on the account, or write to the person who runs this installation.</p>
    </article>
  );
}
