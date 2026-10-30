import { describe, expect, it } from "vitest";
import {
  calendarCells,
  diaryEntries,
  entriesByDay,
  jobsWithoutVisits,
  monthView,
  parseMonthKey,
  parseVisitTime,
  safeDiaryReturn,
  shiftMonth,
} from "@/lib/diary/month";

describe("diary month", () => {
  it("builds a Monday-first grid for October 2026", () => {
    const view = monthView(2026, 10);
    expect(view.label).toBe("October 2026");
    expect(view.startIso).toBe("2026-10-01");
    expect(view.endIso).toBe("2026-10-31");
    const cells = calendarCells(view);
    expect(cells.length % 7).toBe(0);
    expect(cells[0]).toEqual({ iso: "2026-09-28", inMonth: false });
    expect(cells.find((cell) => cell.iso === "2026-10-01")).toEqual({ iso: "2026-10-01", inMonth: true });
    expect(cells.at(-1)).toEqual({ iso: "2026-11-01", inMonth: false });
    expect(shiftMonth(view, 1).key).toBe("2026-11");
    expect(shiftMonth(monthView(2026, 1), -1).key).toBe("2025-12");
  });

  it("ignores a bad month and keeps the current one", () => {
    const now = new Date("2026-10-30T15:00:00.000Z");
    expect(parseMonthKey("nope", now).key).toBe("2026-10");
    expect(parseMonthKey("2026-13", now).key).toBe("2026-10");
    expect(parseMonthKey("2026-04", now).key).toBe("2026-04");
  });

  it("places visits and service reminders on the right day, and leaves other months out", () => {
    const view = monthView(2026, 10);
    const entries = diaryEntries({
      view,
      visits: [
        {
          id: "v1",
          scheduledFor: new Date("2026-10-30T00:00:00.000Z"),
          scheduledTime: "09:30",
          note: "First fix",
          jobId: "job-1",
          jobTitle: "Outside tap",
          customerName: "Riley Sample",
        },
        {
          id: "v2",
          scheduledFor: new Date("2026-11-02T00:00:00.000Z"),
          scheduledTime: "11:00",
          note: "",
          jobId: "job-2",
          jobTitle: "Next month",
          customerName: "Sam Sample",
        },
      ],
      services: [
        {
          id: "svc-1",
          title: "Annual boiler service",
          customerName: "Jordan Sample",
          dueAt: new Date("2026-10-30T00:00:00.000Z"),
          href: "/jobs/job-3",
          detail: "Repeating service on this job. Not a booked visit.",
        },
      ],
    });
    expect(entries.map((entry) => entry.title)).toEqual(["Outside tap", "Annual boiler service"]);
    expect(entries[0].kind).toBe("visit");
    expect(entries[1].kind).toBe("service");
    expect(entries[1].detail).toMatch(/Not a booked visit/);
    const day = entriesByDay(entries).get("2026-10-30");
    expect(day).toHaveLength(2);
  });

  it("lists open jobs that have no visit", () => {
    const open = jobsWithoutVisits([
      { id: "a", status: "BOOKED", visitCount: 0 },
      { id: "b", status: "IN_PROGRESS", visitCount: 2 },
      { id: "c", status: "DONE", visitCount: 0 },
    ]);
    expect(open.map((job) => job.id)).toEqual(["a"]);
  });

  it("accepts a blank time and a time with seconds", () => {
    expect(parseVisitTime("")).toEqual({ ok: true, time: "" });
    expect(parseVisitTime("09:30")).toEqual({ ok: true, time: "09:30" });
    expect(parseVisitTime("09:30:00")).toEqual({ ok: true, time: "09:30" });
    expect(parseVisitTime("25:00").ok).toBe(false);
    expect(safeDiaryReturn("/diary?month=2026-10", "/jobs")).toBe("/diary?month=2026-10");
    expect(safeDiaryReturn("/jobs/abc123", "/diary")).toBe("/jobs/abc123");
    expect(safeDiaryReturn("https://evil.test", "/diary")).toBe("/diary");
  });
});
