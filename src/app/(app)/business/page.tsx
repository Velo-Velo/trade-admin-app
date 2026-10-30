import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { traderAccess } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import { firstParam } from "@/lib/format";
import { platformFeeBps, platformFeeSentence } from "@/lib/payments/fee";
import { connectStatusLabel } from "@/lib/payments/connect-status";
import { syncConnectAccount, onboardingUrl } from "@/lib/payments/connect";
import { isSandboxTrader } from "@/lib/sandbox";
import { stripeConfigured } from "@/lib/stripe";
import { requestOrigin } from "@/lib/origin";
import { TRADES } from "@/lib/trades";
import { SITE_THEME_CHOICES } from "@/lib/site-theme";
import { updateBusiness, updateSiteTheme } from "@/server/business-actions";
import { updateFollowUpSettings } from "@/server/chase-actions";
import { whatsappConnection } from "@/lib/whatsapp/client";
import { createWhatsAppLink, unlinkWhatsApp, updatePaymentSettings } from "@/server/invoice-actions";
import { saveCisProfile } from "@/server/cis-actions";
import { refreshStripeConnect, startStripeConnect } from "@/server/stripe-actions";

export const metadata = { title: "Your page" };

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; stripe?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const origin = await requestOrigin();
  const sandbox = isSandboxTrader({ slug: user.trader.slug, email: user.email });
  const access = traderAccess({
    plan: user.trader.plan,
    sandbox,
    legacyUnlimited: user.trader.legacyUnlimited,
  });
  const stripeFlag = firstParam(query.stripe);
  if (stripeFlag === "return" && user.trader.stripeAccountId && stripeConfigured() && !sandbox) {
    await syncConnectAccount(user.trader.id, user.trader.stripeAccountId);
  }
  if (stripeFlag === "refresh" && user.trader.stripeAccountId && stripeConfigured() && !sandbox) {
    const url = await onboardingUrl({
      accountId: user.trader.stripeAccountId,
      refreshUrl: `${origin}/business?stripe=refresh`,
      returnUrl: `${origin}/business?stripe=return`,
    });
    if (url) redirect(url);
  }
  const trader = (await prisma.trader.findUnique({ where: { id: user.trader.id } })) ?? user.trader;
  const connect = connectStatusLabel({
    stripeConfigured: stripeConfigured(),
    sandbox,
    stripeAccountId: trader.stripeAccountId,
    stripeDetailsSubmitted: trader.stripeDetailsSubmitted,
    stripeChargesEnabled: trader.stripeChargesEnabled,
  });
  const publicUrl = `${origin}/t/${trader.slug}`;

  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <div>
        <h1 className="font-serif text-4xl">Your page</h1>
        <p className="mt-2 text-sm text-muted">
          Public link: <a href={publicUrl}>{publicUrl}</a>
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <form action={updateBusiness} className="grid gap-4">
        <label className={labelClass}>
          Business name
          <input className={inputClass} name="businessName" required defaultValue={trader.businessName} />
        </label>
        <label className={labelClass}>
          Page address
          <input className={inputClass} name="slug" required defaultValue={trader.slug} />
        </label>
        <p className="text-sm text-muted">Changing the address breaks any old link you have already shared.</p>
        <label className={labelClass}>
          Trade
          <select className={inputClass} name="trade" defaultValue={trader.trade}>
            {TRADES.map((trade) => (
              <option key={trade.value} value={trade.value}>
                {trade.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Area
          <input className={inputClass} name="area" required defaultValue={trader.area} />
        </label>
        <label className={labelClass}>
          Postcodes
          <input className={inputClass} name="postcodes" required defaultValue={trader.postcodes} />
        </label>
        <label className={labelClass}>
          Phone
          <input className={inputClass} name="phone" required defaultValue={trader.phone} />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className={labelClass}>
            Text logo
            <input className={inputClass} name="logoText" required defaultValue={trader.logoText} />
          </label>
          <label className={labelClass}>
            Colour
            <input className={`${inputClass} h-12`} name="brandColour" type="color" defaultValue={trader.brandColour} />
          </label>
        </div>
        <label className={labelClass}>
          Services, one per line
          <textarea className={inputClass} name="services" required rows={5} defaultValue={trader.services} />
        </label>
        <label className={labelClass}>
          Introduction
          <textarea className={inputClass} name="bio" rows={4} defaultValue={trader.bio} />
        </label>
        <button className={buttonPrimary} type="submit">
          Save page
        </button>
      </form>
      <form action={updateSiteTheme} className="grid gap-3 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">Theme</h2>
        <p className="text-sm leading-6 text-muted">
          This changes your public page, and the quote and invoice pages customers open. Your colour stays the accent.
        </p>
        <fieldset className="grid gap-3">
          <legend className="sr-only">Theme</legend>
          {SITE_THEME_CHOICES.map((choice) => (
            <label key={choice.id} className="flex gap-3 border border-sand bg-white px-3 py-3">
              <input type="radio" name="siteTheme" value={choice.id} defaultChecked={trader.siteTheme === choice.id} className="mt-1" />
              <span>
                <span className="block font-semibold">{choice.label}</span>
                <span className="mt-1 block text-sm leading-6 text-muted">{choice.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button className={`${buttonSecondary} w-full sm:w-auto`} type="submit">Save theme</button>
      </form>
      <form action={updatePaymentSettings} className="grid gap-4 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">Invoices, bank and reviews</h2>
        <p className="text-sm leading-6 text-muted">
          Bank details are printed on invoices. VAT is added only when you say you are VAT registered. The amount in a quick invoice is the customer total, unless the message says plus VAT.
        </p>
        <label className={labelClass}>
          Trading address
          <textarea className={inputClass} name="tradingAddress" rows={2} defaultValue={trader.tradingAddress} />
        </label>
        <label className={labelClass}>
          Name on the account
          <input className={inputClass} name="bankAccountName" defaultValue={trader.bankAccountName} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Sort code
            <input className={inputClass} name="bankSortCode" defaultValue={trader.bankSortCode} placeholder="00-00-00" />
          </label>
          <label className={labelClass}>
            Account number
            <input className={inputClass} name="bankAccountNumber" defaultValue={trader.bankAccountNumber} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="vatRegistered" defaultChecked={trader.vatRegistered} />
          VAT registered
        </label>
        <label className={labelClass}>
          VAT number
          <input className={inputClass} name="vatNumber" defaultValue={trader.vatNumber} placeholder="GB123456789" />
        </label>
        <label className={labelClass}>
          Google review link
          <input className={inputClass} name="googleReviewUrl" defaultValue={trader.googleReviewUrl} placeholder="https://" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="reviewChasersEnabled" defaultChecked={trader.reviewChasersEnabled} />
          Send review requests after a job is paid or marked complete
        </label>
        <button className={buttonPrimary} type="submit">Save invoice settings</button>
      </form>
      <form action={saveCisProfile} className="grid gap-4 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">CIS</h2>
        <p className="text-sm leading-6 text-muted">
          If a contractor deducts CIS from what they pay you, record the status you want used as the default. Gross is 0%, standard is 20%, higher is 30%. This is a record for you and your accountant. Quotestick does not check it with HMRC, does not file a return, and does not give tax advice. Deductions are added to invoices on Pro.
        </p>
        <label className={labelClass}>
          Your status
          <select className={inputClass} name="cisStatus" defaultValue={trader.cisStatus}>
            <option value="NOT_USED">Not used</option>
            <option value="GROSS">Gross — 0%</option>
            <option value="STANDARD">Standard — 20%</option>
            <option value="HIGHER">Higher — 30%</option>
          </select>
        </label>
        <label className={labelClass}>
          UTR, if you want it on the statement
          <input className={inputClass} name="cisUtr" inputMode="numeric" defaultValue={trader.cisUtr} placeholder="10 digits, optional" />
        </label>
        <button className={buttonPrimary} type="submit">Save CIS status</button>
      </form>
      <form action={updateFollowUpSettings} className="grid gap-4 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">Quote follow-ups and service reminders</h2>
        {access.chasers ? null : <UpgradePrompt feature="chasers" />}
        <p className="text-sm leading-6 text-muted">
          A sent quote with no reply gets a follow-up after the days you set, then a second note if you leave that on. Chasing stops when the customer accepts or declines, or when the quote expires. A repeating job, or a reminder on a customer, invites them to book before a service is due. You get an email when one is ready. The customer is not messaged until you tap Send, unless auto-send is on.
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="quoteChasersEnabled" defaultChecked={trader.quoteChasersEnabled} />
          Chase sent quotes that have not been answered
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Days before the first follow-up
            <input className={inputClass} name="quoteChaseDays" type="number" min={1} max={60} required defaultValue={trader.quoteChaseDays} />
          </label>
          <label className={labelClass}>
            Days before the second follow-up
            <input className={inputClass} name="quoteChaseSecondDays" type="number" min={1} max={90} required defaultValue={trader.quoteChaseSecondDays} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="quoteChaseSecondNudge" defaultChecked={trader.quoteChaseSecondNudge} />
          Send a second quote reminder
        </label>
        <label className={labelClass}>
          Days a quote stays open
          <input className={inputClass} name="quoteValidDays" type="number" min={0} max={365} required defaultValue={trader.quoteValidDays} />
        </label>
        <p className="text-sm leading-6 text-muted">
          Use 0 if a quote should not expire. The default is 30 days. This applies to quotes you approve from now on. After the date, chasing stops and the customer cannot accept it.
        </p>
        <label className={labelClass}>
          Weeks before a service is due
          <input className={inputClass} name="serviceRemindWeeks" type="number" min={1} max={26} required defaultValue={trader.serviceRemindWeeks} />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="autoSendQuoteChasers" defaultChecked={trader.autoSendQuoteChasers} />
          Auto-send quote chasers and service reminders to the customer
        </label>
        <p className="text-sm leading-6 text-muted">
          Leave this off if you want to read each note in Follow-ups before it goes to the customer. You are still emailed when one is ready. Email is used when the customer has an address. WhatsApp is used as well when it is connected and they have a mobile number.
        </p>
        <button className={buttonPrimary} type="submit">Save follow-up settings</button>
      </form>
      <section id="stripe-connect" className="grid gap-3 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">Connect Stripe</h2>
        <p className="text-sm font-semibold">{connect.label}</p>
        <p className="text-sm leading-6 text-muted">{connect.detail}</p>
        <p className="text-sm leading-6 text-muted">{platformFeeSentence(platformFeeBps())}</p>
        <p className="text-sm leading-6 text-muted">
          Card, Apple Pay and Google Pay. Bank transfer by Bacs is not offered here. Customers pay on the quote or invoice page, and the money goes to your connected account.
        </p>
        {access.cardPayments ? null : <UpgradePrompt feature="card_payments" />}
        {sandbox || (!access.cardPayments && !trader.stripeAccountId) ? null : stripeConfigured() ? (
          <form action={trader.stripeAccountId && !trader.stripeChargesEnabled ? refreshStripeConnect : startStripeConnect}>
            <button className={buttonPrimary} type="submit">
              {trader.stripeChargesEnabled ? "Update Stripe details" : trader.stripeAccountId ? "Continue Stripe setup" : "Connect Stripe"}
            </button>
          </form>
        ) : (
          <p className="text-sm leading-6">The Connect button stays hidden until a Stripe secret key is set. No payment can be taken.</p>
        )}
      </section>
      <section className="grid gap-3 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">WhatsApp</h2>
        <p className="text-sm leading-6">
          {whatsappConnection().connected ? "WhatsApp is connected." : "WhatsApp is not connected."}
        </p>
        <p className="text-sm leading-6 text-muted">
          {trader.whatsappVerifiedAt && trader.whatsappE164
            ? `Linked number +${trader.whatsappE164}. A photo of a receipt from this phone is saved for you to check. It works on every plan.`
            : "Create a code, then send LINK and the code from your own WhatsApp. That verifies the number, so a receipt cannot be filed on the wrong account."}
        </p>
        <form action={createWhatsAppLink}>
          <button className={buttonSecondary} type="submit">Create a link code</button>
        </form>
        {trader.whatsappE164 ? (
          <form action={unlinkWhatsApp}>
            <button className={buttonSecondary} type="submit">Unlink number</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
