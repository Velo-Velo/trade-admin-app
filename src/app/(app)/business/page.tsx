import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { firstParam } from "@/lib/format";
import { requestOrigin } from "@/lib/origin";
import { TRADES } from "@/lib/trades";
import { updateBusiness } from "@/server/business-actions";

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
    </div>
  );
}
