import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { checklistItemApplies, checklistProgress } from "@/lib/checklist/catalog";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateInputValue, firstParam, formatDate } from "@/lib/format";
import { updateChecklistItem } from "@/server/checklist-actions";

export const metadata = { title: "Checklist" };

const statusOptions = [
  ["NOT_STARTED", "Not started"],
  ["IN_PROGRESS", "In progress"],
  ["DONE", "Done"],
  ["NOT_APPLICABLE", "Not applicable"],
];

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const items = await prisma.checklistItem.findMany({
    where: { traderId: user.trader.id },
    orderBy: { sortOrder: "asc" },
  });
  const progress = checklistProgress(items);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-serif text-4xl">Start-up checklist</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          A reminder list for a UK sole trader, filtered for your trade. It is general information, not legal or tax advice.
          Tick an item when you have done it, add a number and an expiry date if it has one, and we can remind you before it runs out.
          A badge only appears on your page when you mark it done, enter a number, and choose to show it. Quotestick does not check the register.
        </p>
        <p className="mt-3 text-sm text-muted">
          {progress.done} of {progress.total} done
        </p>
        <div className="mt-2 h-2 max-w-md rounded-full bg-sand">
          <div className="h-2 rounded-full bg-pine" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <ul className="grid gap-4">
        {items.map((item) => {
          const applies = checklistItemApplies(item.key, user.trader!.trade);
          return (
            <li key={item.id} className="card grid gap-3">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-2xl">{item.title}</h2>
                {item.expiresAt ? (
                  <p className="text-sm text-muted">Expires {formatDate(item.expiresAt)}</p>
                ) : null}
              </div>
              {!applies ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Kept from an earlier trade setting</p>
              ) : null}
              <p className="text-sm leading-6 text-muted">{item.detail}</p>
              <a href={item.officialUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold">
                Official page
              </a>
              <form action={updateChecklistItem} className="grid gap-3">
                <input type="hidden" name="id" value={item.id} />
                <label className={labelClass}>
                  Status
                  <select className={inputClass} name="status" defaultValue={item.status}>
                    {statusOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Registration or policy number
                  <input className={inputClass} name="referenceNumber" defaultValue={item.referenceNumber} maxLength={80} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    Expiry date
                    <input className={inputClass} type="date" name="expiresAt" defaultValue={dateInputValue(item.expiresAt)} />
                  </label>
                  <label className={labelClass}>
                    Remind me this many days before
                    <input className={inputClass} name="reminderDays" type="number" min={1} max={180} defaultValue={item.reminderDays} />
                  </label>
                </div>
                {item.badgeLabel ? (
                  <label className="flex items-start gap-3 text-sm">
                    <input className="mt-1 h-5 w-5" type="checkbox" name="showOnWebsite" defaultChecked={item.showOnWebsite} />
                    <span>Show “{item.badgeLabel}” on your page once this is done and has a number.</span>
                  </label>
                ) : (
                  <p className="text-sm text-muted">This item is not shown as a badge.</p>
                )}
                <button className={buttonPrimary} type="submit">
                  Save
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
