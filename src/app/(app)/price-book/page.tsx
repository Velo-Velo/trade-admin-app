import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Flash } from "@/components/flash";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { buttonPrimary, buttonQuiet, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { traderAccess } from "@/lib/billing/plans";
import { isSandboxTrader } from "@/lib/sandbox";
import { prisma } from "@/lib/db";
import { dateInputValue, firstParam, formatDate, formatGBP, penceToPoundsInput } from "@/lib/format";
import { addPriceBookItem, deletePriceBookItem, updatePriceBookItem } from "@/server/price-book-actions";

export const metadata = { title: "Price book" };

export default async function PriceBookPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const access = traderAccess({
    plan: user.trader.plan,
    sandbox: isSandboxTrader({ slug: user.trader.slug, email: user.email }),
    legacyUnlimited: user.trader.legacyUnlimited,
  });
  const items = await prisma.priceBookItem.findMany({
    where: { traderId: user.trader.id },
    orderBy: { description: "asc" },
  });

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-serif text-4xl">Price book</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Enter the prices you sell at. Where you know it, add what you last paid and when.
          Draft quotes use a matching row instead of the starter template figure, and show last paid on the line.
          Splitstick is not connected. When it is, receipt prices can update last paid without wiping a sell price you have set.
          You can still type a sell price and a last-paid figure yourself.
        </p>
      </div>
      {access.splitstick ? null : <UpgradePrompt feature="splitstick" />}
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />

      <form action={addPriceBookItem} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Add a price</h2>
        <label className={labelClass}>
          Description
          <input className={inputClass} name="description" required placeholder="15mm isolation valve" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            Type
            <select className={inputClass} name="kind" defaultValue="MATERIAL">
              <option value="MATERIAL">Materials</option>
              <option value="LABOUR">Labour</option>
            </select>
          </label>
          <label className={labelClass}>
            Unit
            <input className={inputClass} name="unit" required placeholder="item" />
          </label>
          <label className={labelClass}>
            Sell price £
            <input className={inputClass} name="sellPrice" required inputMode="decimal" placeholder="4.50" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Last paid £ (optional)
            <input className={inputClass} name="lastPaid" inputMode="decimal" placeholder="3.20" />
          </label>
          <label className={labelClass}>
            Last paid date
            <input className={inputClass} name="lastPaidAt" type="date" />
          </label>
        </div>
        <button className={buttonPrimary} type="submit">
          Add price
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted">No prices yet. Drafts will keep using starter template figures until you add a row.</p>
      ) : (
        <ul className="grid gap-4">
          {items.map((item) => (
            <li key={item.id} className="card">
              <form action={updatePriceBookItem} className="grid gap-3">
                <input type="hidden" name="id" value={item.id} />
                <label className={labelClass}>
                  Description
                  <input className={inputClass} name="description" defaultValue={item.description} required />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className={labelClass}>
                    Type
                    <select className={inputClass} name="kind" defaultValue={item.kind}>
                      <option value="MATERIAL">Materials</option>
                      <option value="LABOUR">Labour</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    Unit
                    <input className={inputClass} name="unit" defaultValue={item.unit} required />
                  </label>
                  <label className={labelClass}>
                    Sell price £
                    <input className={inputClass} name="sellPrice" defaultValue={penceToPoundsInput(item.sellPricePence)} required />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    Last paid £
                    <input
                      className={inputClass}
                      name="lastPaid"
                      defaultValue={item.lastPaidPence === null ? "" : penceToPoundsInput(item.lastPaidPence)}
                    />
                  </label>
                  <label className={labelClass}>
                    Last paid date
                    <input className={inputClass} name="lastPaidAt" type="date" defaultValue={dateInputValue(item.lastPaidAt)} />
                  </label>
                </div>
                <p className="text-sm text-muted">
                  {item.lastPaidPence !== null ? `Last paid ${formatGBP(item.lastPaidPence)}` : "No last paid price yet"}
                  {item.lastPaidAt ? ` on ${formatDate(item.lastPaidAt)}` : ""}. Source:{" "}
                  {item.source === "SPLITSTICK" ? `Splitstick${item.merchant ? ` · ${item.merchant}` : ""}` : "entered by you"}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button className={buttonPrimary} type="submit">
                    Save
                  </button>
                </div>
              </form>
              <form action={deletePriceBookItem} className="mt-2">
                <input type="hidden" name="id" value={item.id} />
                <ConfirmSubmit label="Remove" message="Remove this price?" className={buttonQuiet} />
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
