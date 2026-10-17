const styles: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-950",
  SENT: "bg-sky-100 text-sky-950",
  ACCEPTED: "bg-emerald-100 text-emerald-950",
  DECLINED: "bg-stone-200 text-stone-700",
  PAID: "bg-emerald-100 text-emerald-950",
  BOOKED: "bg-amber-100 text-amber-950",
  IN_PROGRESS: "bg-sky-100 text-sky-950",
  DONE: "bg-emerald-100 text-emerald-950",
};

const labels: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  PAID: "Paid",
  BOOKED: "Booked",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] ?? "bg-sand"}`}>
      {labels[status] ?? status}
    </span>
  );
}
