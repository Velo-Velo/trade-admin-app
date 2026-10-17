import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { customerMatches, customerSearchText, normalisePhone, searchNeedles } from "@/lib/customers/match";
import { prepareJobPhoto } from "@/lib/images/prepare";
import {
  bookedJobPlan,
  canMoveJob,
  invoiceMarker,
  jobTitleFromDescription,
  soleUninvoicedJob,
} from "@/lib/jobs/board";

const jones = customerSearchText({
  name: "Mrs Jones Sample",
  phone: "",
  email: "mrs.jones.sample@example.com",
  postcode: "LS1 1AA",
  address: "8 Sample Road, Leeds",
});

const priya = customerSearchText({
  name: "Priya Sample",
  phone: "07700 900201",
  email: "",
  postcode: "M1 1AE",
  address: "",
});

const riley = customerSearchText({
  name: "Riley Sample",
  phone: "07700 900301",
  email: "",
  postcode: "BS1 4ST",
  address: "14 Sample Street, Bristol",
});

describe("customer search", () => {
  it("matches part of a name, email, postcode, address or phone", () => {
    expect(customerMatches(jones, "jone")).toBe(true);
    expect(customerMatches(jones, "jones.sample")).toBe(true);
    expect(customerMatches(jones, "ls1")).toBe(true);
    expect(customerMatches(jones, "sample road")).toBe(true);
    expect(customerMatches(priya, "900201")).toBe(true);
    expect(customerMatches(priya, "07700 900201")).toBe(true);
    expect(customerMatches(priya, "+447700900201")).toBe(true);
    expect(customerMatches(riley, "sample street")).toBe(true);
    expect(customerMatches(jones, "bristol")).toBe(false);
    expect(customerMatches(priya, "mrs jones")).toBe(false);
  });

  it("stores UK mobiles as 44 so 07 and +44 are the same number", () => {
    expect(normalisePhone("07700 900201")).toBe("447700900201");
    expect(normalisePhone("+44 7700 900201")).toBe("447700900201");
    expect(searchNeedles("07700 900201")).toEqual(expect.arrayContaining(["07700", "447700", "900201"]));
  });
});

describe("job board", () => {
  it("moves one column at a time", () => {
    expect(canMoveJob("BOOKED", "IN_PROGRESS")).toBe(true);
    expect(canMoveJob("IN_PROGRESS", "DONE")).toBe(true);
    expect(canMoveJob("DONE", "IN_PROGRESS")).toBe(true);
    expect(canMoveJob("BOOKED", "DONE")).toBe(false);
    expect(canMoveJob("DONE", "BOOKED")).toBe(false);
  });

  it("creates a booked job only after the quote is accepted", () => {
    expect(bookedJobPlan("DRAFT")).toBeNull();
    expect(bookedJobPlan("SENT")).toBeNull();
    expect(bookedJobPlan("ACCEPTED")).toEqual({ status: "BOOKED" });
  });

  it("shows invoiced or paid from the invoice, and hides drafts", () => {
    expect(invoiceMarker("DRAFT")).toBeNull();
    expect(invoiceMarker("SENT")).toBe("invoiced");
    expect(invoiceMarker("PAID")).toBe("paid");
    expect(invoiceMarker(null)).toBeNull();
  });

  it("links a new invoice only when there is one job waiting", () => {
    expect(soleUninvoicedJob([{ invoiceId: null }, { invoiceId: "inv" }])?.invoiceId).toBeNull();
    expect(soleUninvoicedJob([{ invoiceId: null }, { invoiceId: null }])).toBeNull();
    expect(soleUninvoicedJob([{ invoiceId: "inv" }])).toBeNull();
  });

  it("keeps job titles short", () => {
    expect(jobTitleFromDescription("Replace the tap.\nMore detail")).toBe("Replace the tap.");
    expect(jobTitleFromDescription("x".repeat(120)).endsWith("…")).toBe(true);
  });
});

describe("job photos", () => {
  it("resizes and compresses a large photo to a jpeg", async () => {
    const source = await sharp({
      create: { width: 2400, height: 1800, channels: 3, background: { r: 40, g: 90, b: 70 } },
    })
      .png()
      .toBuffer();
    const prepared = await prepareJobPhoto(source);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.mimeType).toBe("image/jpeg");
    expect(prepared.width).toBeLessThanOrEqual(1600);
    expect(prepared.height).toBeLessThanOrEqual(1600);
    expect(prepared.bytes.length).toBeLessThan(source.length);
  });

  it("rejects a file that is not a photo", async () => {
    const prepared = await prepareJobPhoto(new Uint8Array(Buffer.from("not a photo")));
    expect(prepared.ok).toBe(false);
  });
});
