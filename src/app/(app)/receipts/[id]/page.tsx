import { notFound, redirect } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Flash } from "@/components/flash";
import { StatusPill } from "@/components/status-pill";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateInputValue, firstParam, penceToPoundsInput } from "@/lib/format";
import { RECEIPT_RECORD_NOTE } from "@/lib/receipts/copy";
import { CATEGORY_LABEL, EXPENSE_CATEGORIES } from "@/lib/receipts/fields";
import { deleteReceipt, saveReceipt } from "@/server/receipt-actions";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const { id } = await params;
  const query = await searchParams;
  const expense = await prisma.expense.findFirst({
    where: { id, traderId: user.trader.id },
  });
  if (!expense) notFound();
  const [jobs, customers] = await Promise.all([
    prisma.job.findMany({
      where: { traderId: user.trader.id },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, title: true, customer: { select: { name: true } } },
    }),
    prisma.customer.findMany({
      where: { traderId: user.trader.id },
      orderBy: { name: "asc" },
      take: 80,
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div>
        <p className="text-sm font-semibold text-muted">
          <a href="/receipts">Receipts</a>
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="font-serif text-4xl">{expense.supplier || "Receipt"}</h1>
          <StatusPill status={expense.status} />
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">{RECEIPT_RECORD_NOTE}</p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      {expense.extractionNote ? <p className="card text-sm leading-6">{expense.extractionNote}</p> : null}
      <img src={`/api/receipts/${expense.id}/image`} alt="Receipt photo" className="w-full rounded-2xl border border-sand bg-white" />
      <form action={saveReceipt} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Check the figures</h2>
        <input type="hidden" name="expenseId" value={expense.id} />
        <label className={labelClass}>
          Supplier
          <input className={inputClass} name="supplier" defaultValue={expense.supplier} />
        </label>
        <label className={labelClass}>
          What you bought
          <input className={inputClass} name="description" defaultValue={expense.description} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Date on the receipt
            <input className={inputClass} name="spentOn" type="date" defaultValue={dateInputValue(expense.spentOn)} />
          </label>
          <label className={labelClass}>
            Category
            <select className={inputClass} name="category" defaultValue={expense.category}>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Total (£)
            <input className={inputClass} name="total" inputMode="decimal" defaultValue={expense.totalPence != null ? penceToPoundsInput(expense.totalPence) : ""} placeholder="18.60" />
          </label>
          <label className={labelClass}>
            VAT on the receipt (£)
            <input className={inputClass} name="vat" inputMode="decimal" defaultValue={expense.vatPence != null ? penceToPoundsInput(expense.vatPence) : ""} placeholder="Leave blank if not shown" />
          </label>
        </div>
        <p className="text-sm leading-6 text-muted">Leave VAT blank when the receipt does not print a VAT amount. Do not guess it.</p>
        <label className={labelClass}>
          Job
          <select className={inputClass} name="jobId" defaultValue={expense.jobId ?? ""}>
            <option value="">None</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} · {job.customer.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Customer, if there is no job
          <select className={inputClass} name="customerId" defaultValue={expense.jobId ? "" : (expense.customerId ?? "")}>
            <option value="">None</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm leading-6 text-muted">Choosing a job uses that job’s customer. A customer on its own is enough when the receipt is not for one job.</p>
        <div className="flex flex-wrap gap-2">
          <button className={buttonSecondary} type="submit" name="intent" value="save">Save</button>
          <button className={buttonPrimary} type="submit" name="intent" value="confirm">Confirm receipt</button>
        </div>
      </form>
      <form action={deleteReceipt}>
        <input type="hidden" name="expenseId" value={expense.id} />
        <ConfirmSubmit className={buttonSecondary} label="Delete receipt" message="Delete this receipt photo and the figures? This cannot be undone." />
      </form>
    </div>
  );
}
