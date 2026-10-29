import { isServiceDueSoon } from "@/lib/chasers/plan";
import { formatDate } from "@/lib/format";

export type ReminderListItem = {
  id: string;
  title: string;
  customerName: string;
  dueAt: Date;
  href: string;
};

export function ReminderList({
  items,
  now,
  remindWeeks,
  empty,
}: {
  items: ReminderListItem[];
  now: Date;
  remindWeeks: number;
  empty: string;
}) {
  if (items.length === 0) return <p className="card text-sm text-muted">{empty}</p>;
  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const dueSoon = isServiceDueSoon({ recurring: true, serviceDueAt: item.dueAt }, now, remindWeeks);
        return (
          <a key={item.id} href={item.href} className="card block no-underline">
            <p className="font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-sm text-muted">
              {item.customerName} · due {formatDate(item.dueAt)}
              {dueSoon ? " · due soon" : ""}
            </p>
          </a>
        );
      })}
    </div>
  );
}
