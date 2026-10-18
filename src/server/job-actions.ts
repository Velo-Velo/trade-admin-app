"use server";

import { getCurrentUser } from "@/lib/auth";
import { addMonths } from "@/lib/chasers/plan";
import { customerSearchText, normalisePhone } from "@/lib/customers/match";
import { findOrCreateCustomer } from "@/lib/customers/store";
import { prisma } from "@/lib/db";
import { customerEmail, parseDateInput } from "@/lib/format";
import { photoBytes, prepareJobPhoto } from "@/lib/images/prepare";
import { canMoveJob, isJobStatus, JOB_PHOTO_LIMIT } from "@/lib/jobs/board";
import { redirectWith } from "@/lib/redirects";

async function requireTrader() {
  const user = await getCurrentUser();
  return user?.trader ?? null;
}

export async function createJob(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const name = String(formData.get("name") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const contact = String(formData.get("contact") || "").trim();
  const postcode = String(formData.get("postcode") || "").trim();
  const address = String(formData.get("address") || "").trim();
  if (name.length < 2 || title.length < 2) {
    redirectWith("/jobs", "error", "Add the customer name and a short description of the job.");
  }
  const customer = await findOrCreateCustomer(prisma, {
    traderId: trader.id,
    name,
    contact,
    postcode,
    address,
  });
  const job = await prisma.job.create({
    data: {
      traderId: trader.id,
      customerId: customer.id,
      title: title.slice(0, 120),
      postcode,
      address,
      status: "BOOKED",
    },
  });
  redirectWith(`/jobs/${job.id}`, "notice", "Job booked. Nothing has been sent to the customer.");
}

export async function moveJob(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("jobId") || "");
  const target = String(formData.get("status") || "");
  const requested = String(formData.get("returnTo") || "");
  const back = requested === "/jobs" || requested.startsWith("/jobs/") ? requested.split("?")[0] : `/jobs/${id}`;
  if (!isJobStatus(target)) redirectWith("/jobs", "error", "That status is not on the board.");
  const job = await prisma.job.findFirst({ where: { id, traderId: trader.id } });
  if (!job) redirectWith("/jobs", "error", "That job could not be found.");
  if (!canMoveJob(job.status, target)) {
    redirectWith(back, "error", "Move the job one column at a time.");
  }
  const now = new Date();
  const rollService = target === "DONE" && job.recurring;
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: target,
      startedAt: target === "BOOKED" ? null : target === "IN_PROGRESS" ? (job.startedAt ?? now) : job.startedAt,
      doneAt: target === "DONE" ? (job.doneAt ?? now) : null,
      ...(rollService
        ? {
            serviceDueAt: addMonths(now, job.intervalMonths || 12),
            serviceChaseStage: 0,
            lastServiceChasedAt: null,
          }
        : {}),
    },
  });
  if (rollService) {
    await prisma.customerChase.deleteMany({ where: { jobId: job.id } });
  }
  redirectWith(back, "notice", rollService ? "Job marked done. The next service date is set. Nothing has been sent to the customer." : "Job updated. Nothing has been sent to the customer.");
}

export async function updateJobService(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("jobId") || "");
  const job = await prisma.job.findFirst({ where: { id, traderId: trader.id } });
  if (!job) redirectWith("/jobs", "error", "That job could not be found.");
  const recurring = formData.get("recurring") === "on";
  const intervalRaw = String(formData.get("intervalMonths") || "").trim();
  if (!/^\d+$/.test(intervalRaw)) {
    redirectWith(`/jobs/${job.id}`, "error", "Enter how many months between services, from 1 to 60.");
  }
  const intervalMonths = Number(intervalRaw);
  if (intervalMonths < 1 || intervalMonths > 60) {
    redirectWith(`/jobs/${job.id}`, "error", "Services repeat every 1 to 60 months.");
  }
  const dueRaw = String(formData.get("serviceDueAt") || "").trim();
  let serviceDueAt = parseDateInput(dueRaw);
  if (dueRaw && !serviceDueAt) {
    redirectWith(`/jobs/${job.id}`, "error", "Enter the next service date as a calendar date.");
  }
  if (recurring && !serviceDueAt && job.status === "DONE") {
    serviceDueAt = addMonths(job.doneAt ?? new Date(), intervalMonths);
  }
  const previous = job.serviceDueAt ? job.serviceDueAt.toISOString().slice(0, 10) : "";
  const next = serviceDueAt ? serviceDueAt.toISOString().slice(0, 10) : "";
  const reset = !recurring || previous !== next;
  await prisma.job.update({
    where: { id: job.id },
    data: {
      recurring,
      intervalMonths,
      serviceDueAt: recurring ? serviceDueAt : job.serviceDueAt,
      ...(reset ? { serviceChaseStage: 0, lastServiceChasedAt: null } : {}),
    },
  });
  if (reset) {
    await prisma.customerChase.deleteMany({ where: { jobId: job.id, kind: "SERVICE" } });
  }
  redirectWith(
    `/jobs/${job.id}`,
    "notice",
    recurring
      ? "Service schedule saved. A reminder is queued when it is due, and it is not sent until you approve it."
      : "This job is no longer a repeating service. Nothing has been sent.",
  );
}

export async function linkJobInvoice(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("jobId") || "");
  const invoiceId = String(formData.get("invoiceId") || "");
  const job = await prisma.job.findFirst({ where: { id, traderId: trader.id } });
  if (!job) redirectWith("/jobs", "error", "That job could not be found.");
  if (!invoiceId) {
    await prisma.job.update({ where: { id: job.id }, data: { invoiceId: null } });
    redirectWith(`/jobs/${job.id}`, "notice", "Invoice removed from this job.");
  }
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, traderId: trader.id, customerId: job.customerId },
  });
  if (!invoice) {
    redirectWith(`/jobs/${job.id}`, "error", "Choose an invoice for this customer.");
  }
  await prisma.job.updateMany({
    where: { invoiceId: invoice.id, NOT: { id: job.id } },
    data: { invoiceId: null },
  });
  await prisma.job.update({ where: { id: job.id }, data: { invoiceId: invoice.id } });
  redirectWith(`/jobs/${job.id}`, "notice", "Invoice linked. The customer is not told unless that invoice was already approved.");
}

export async function uploadJobPhotos(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("jobId") || "");
  const kind = formData.get("kind") === "AFTER" ? "AFTER" : "BEFORE";
  const job = await prisma.job.findFirst({ where: { id, traderId: trader.id } });
  if (!job) redirectWith("/jobs", "error", "That job could not be found.");
  const files = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) redirectWith(`/jobs/${job.id}`, "error", "Choose at least one photo.");
  if (files.length > 6) redirectWith(`/jobs/${job.id}`, "error", "You can add up to 6 photos at a time.");
  const existing = await prisma.jobPhoto.count({ where: { jobId: job.id } });
  if (existing + files.length > JOB_PHOTO_LIMIT) {
    redirectWith(`/jobs/${job.id}`, "error", `A job can hold ${JOB_PHOTO_LIMIT} photos.`);
  }
  for (const file of files) {
    const prepared = await prepareJobPhoto(new Uint8Array(await file.arrayBuffer()));
    if (!prepared.ok) redirectWith(`/jobs/${job.id}`, "error", prepared.error);
    const filename = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 80) || (kind === "AFTER" ? "after.jpg" : "before.jpg");
    await prisma.jobPhoto.create({
      data: {
        jobId: job.id,
        kind,
        filename,
        mimeType: prepared.mimeType,
        bytes: photoBytes(prepared.bytes),
      },
    });
  }
  redirectWith(`/jobs/${job.id}`, "notice", "Photos saved on this job. They are not sent to the customer.");
}

export async function updateCustomerDetails(formData: FormData) {
  const trader = await requireTrader();
  if (!trader) redirectWith("/login", "error", "Sign in to continue.");
  const id = String(formData.get("customerId") || "");
  const customer = await prisma.customer.findFirst({ where: { id, traderId: trader.id } });
  if (!customer) redirectWith("/customers", "error", "That customer could not be found.");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = normalisePhone(String(formData.get("phone") || ""));
  const postcode = String(formData.get("postcode") || "").trim();
  const address = String(formData.get("address") || "").trim();
  if (name.length < 2) redirectWith(`/customers/${id}`, "error", "Enter the customer name.");
  if (email && !customerEmail(email)) redirectWith(`/customers/${id}`, "error", "That email address does not look right.");
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name,
      email,
      phone,
      postcode,
      address,
      searchText: customerSearchText({ name, email, phone, postcode, address }),
    },
  });
  redirectWith(`/customers/${id}`, "notice", "Customer details saved.");
}
