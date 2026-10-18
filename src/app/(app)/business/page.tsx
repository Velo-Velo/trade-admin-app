import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { firstParam } from "@/lib/format";
import { requestOrigin } from "@/lib/origin";
import { TRADES } from "@/lib/trades";
import { updateBusiness } from "@/server/business-actions";
import { createWhatsAppLink, unlinkWhatsApp, updatePaymentSettings } from "@/server/invoice-actions";

export const metadata = { title: "Your page" };

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const trader = user.trader;
  const query = await searchParams;
  const origin = await requestOrigin();
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
      <section className="grid gap-3 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">WhatsApp</h2>
        <p className="text-sm leading-6 text-muted">
          {trader.whatsappE164
            ? `Linked number +${trader.whatsappE164}. Messages to the Quotestick WhatsApp number from this phone create drafts.`
            : "Create a code, then send LINK and the code from your own WhatsApp to the Quotestick number."}
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
