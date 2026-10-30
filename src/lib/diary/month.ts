export type DiaryEntry = {
  id: string;
  kind: "visit" | "service";
  title: string;
  customerName: string;
  iso: string;
  time: string;
  href: string;
  detail: string;
};

export type MonthView = {
  year: number;
  month: number;
  key: string;
  label: string;
  startIso: string;
  endIso: string;
};

export type CalendarCell = { iso: string; inMonth: boolean };

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthView(year: number, month: number): MonthView {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const key = `${year}-${String(month).padStart(2, "0")}`;
  return {
    year,
    month,
    key,
    label: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    ),
    startIso: `${key}-01`,
    endIso: `${key}-${String(last).padStart(2, "0")}`,
  };
}

export function parseMonthKey(value: string | undefined, now: Date): MonthView {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) return monthView(year, month);
  }
  return monthView(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

export function shiftMonth(view: MonthView, delta: number): MonthView {
  const date = new Date(Date.UTC(view.year, view.month - 1 + delta, 1));
  return monthView(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

/** Monday-first month grid, including the leading and trailing days from neighbouring months. */
export function calendarCells(view: MonthView): CalendarCell[] {
  const first = new Date(Date.UTC(view.year, view.month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i += 1) {
    const date = new Date(Date.UTC(view.year, view.month - 1, 1 - (lead - i)));
    cells.push({ iso: isoDate(date), inMonth: false });
  }
  const last = Number(view.endIso.slice(-2));
  for (let day = 1; day <= last; day += 1) {
    cells.push({ iso: `${view.key}-${String(day).padStart(2, "0")}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const previous = new Date(`${cells[cells.length - 1].iso}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() + 1);
    cells.push({ iso: isoDate(previous), inMonth: false });
  }
  return cells;
}

export function inMonth(iso: string, view: MonthView): boolean {
  return iso >= view.startIso && iso <= view.endIso;
}

export function parseVisitTime(value: string): { ok: true; time: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, time: "" };
  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return { ok: false, error: "Enter the time as HH:MM, or leave it blank." };
  return { ok: true, time: `${match[1]}:${match[2]}` };
}

export function safeDiaryReturn(value: string, fallback: string): string {
  if (value === "/diary" || /^\/diary\?month=\d{4}-\d{2}$/.test(value)) return value;
  if (/^\/jobs\/[a-z0-9]+$/i.test(value)) return value;
  return fallback;
}

type VisitInput = {
  id: string;
  scheduledFor: Date;
  scheduledTime: string;
  note: string;
  jobId: string;
  jobTitle: string;
  customerName: string;
};

type ServiceInput = {
  id: string;
  title: string;
  customerName: string;
  dueAt: Date;
  href: string;
  detail: string;
};

function sortEntries(a: DiaryEntry, b: DiaryEntry): number {
  const time = (a.time || "99:99").localeCompare(b.time || "99:99");
  if (time !== 0) return time;
  if (a.kind !== b.kind) return a.kind === "visit" ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export function diaryEntries(input: { visits: VisitInput[]; services: ServiceInput[]; view: MonthView }): DiaryEntry[] {
  const entries: DiaryEntry[] = [];
  for (const visit of input.visits) {
    const iso = isoDate(visit.scheduledFor);
    if (!inMonth(iso, input.view)) continue;
    entries.push({
      id: visit.id,
      kind: "visit",
      title: visit.jobTitle,
      customerName: visit.customerName,
      iso,
      time: visit.scheduledTime,
      href: `/jobs/${visit.jobId}`,
      detail: visit.note,
    });
  }
  for (const service of input.services) {
    const iso = isoDate(service.dueAt);
    if (!inMonth(iso, input.view)) continue;
    entries.push({
      id: service.id,
      kind: "service",
      title: service.title,
      customerName: service.customerName,
      iso,
      time: "",
      href: service.href,
      detail: service.detail,
    });
  }
  return entries.sort(sortEntries);
}

export function entriesByDay(entries: DiaryEntry[]): Map<string, DiaryEntry[]> {
  const grouped = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.iso) ?? [];
    list.push(entry);
    grouped.set(entry.iso, list);
  }
  return grouped;
}

export function jobsWithoutVisits<T extends { status: string; visitCount: number }>(jobs: T[]): T[] {
  return jobs.filter((job) => job.visitCount === 0 && job.status !== "DONE");
}
