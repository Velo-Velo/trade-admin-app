import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { StatusPill } from "@/components/status-pill";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { firstParam, formatDate, formatGBP } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/receipts/fields";
import { RECEIPT_RECORD_NOTE } from "@/lib/receipts/copy";
import { whatsappConnection } from "@/lib/whatsapp/client";
import { uploadReceipt } from "@/server/receipt-actions";

export const metadata = { title: "Receipts" };

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const trader = user.trader;
  const connected = whatsappConnection().connected;
  const expenses = await prisma.expense.findMany({
    where: { traderId: trader.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      supplier: true,
      description: true,
      spentOn: true,
      totalPence: true,
      vatPence: true,
      category: true,
      job: { select: { title: true } },
      customer: { select: { name: true } },
    },
  });
  const waiting = expenses.filter((expense) => expense.status === "NEEDS_REVIEW").length;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-serif text-4xl">Receipts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Send a photo of a receipt (materials, fuel, tools) from your linked WhatsApp number. Check the supplier, date, total and any VAT it shows, then confirm. {RECEIPT_RECORD_NOTE}
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <section className="card grid gap-2">
        <h2 className="font-serif text-2xl">WhatsApp</h2>
        {connected ? (
          <p className="text-sm leading-6 text-muted">
            WhatsApp is connected.
            {trader.whatsappVerifiedAt && trader.whatsappE164
              ? ` Photos from +${trader.whatsappE164} are saved here for you to check.`
              : " Link your number on Your page, then send the photo from that phone."}
          </p>
        ) : (
          <p className="text-sm leading-6">
            WhatsApp is not connected. Photos you send from your phone will not arrive until it is. You can still add a receipt photo on this page.
          </p>
        )}
        {waiting > 0 ? <p className="text-sm font-semibold">{waiting} waiting for you to check.</p> : null}
      </section>
      <form action={uploadReceipt} className="card grid gap-3">
        <h2 className="font-serif text-2xl">Add a receipt photo</h2>
        <label className={labelClass}>
          Photo
          <input className={`${inputClass} file:mr-3 file:border-0 file:bg-sand file:px-3 file:py-2 file:text-sm file:font-semibold`} type="file" name="photo" accept="image/*" required />
        </label>
        <label className={labelClass}>
          Note, if you want it linked to a job
          <input className={inputClass} name="note" placeholder="Outside tap, copper pipe" />
        </label>
        <button className={buttonPrimary} type="submit">Save receipt</button>
      </form>
      {expenses.length === 0 ? (
        <p className="card text-sm text-muted">No receipts yet.</p>
      ) : (
        <ul className="grid gap-3">
          {expenses.map((expense) => (
            <li key={expense.id}>
              <a href={`/receipts/${expense.id}`} className="card grid gap-3 no-underline sm:grid-cols-[7rem_1fr]">
                <img src={`/api/receipts/${expense.id}/image`} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-ink">{expense.supplier || "Supplier not entered"}</p>
                    <StatusPill status={expense.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {CATEGORY_LABEL[expense.category]}
                    {expense.spentOn ? ` · ${formatDate(expense.spentOn)}` : ""}
                    {expense.totalPence != null ? ` · ${formatGBP(expense.totalPence)}` : " · total not entered"}
                    {expense.vatPence != null ? ` · VAT ${formatGBP(expense.vatPence)}` : ""}
                  </p>
                  {expense.description ? <p className="mt-1 text-sm text-muted">{expense.description}</p> : null}
                  {expense.job || expense.customer ? (
                    <p className="mt-2 text-sm text-muted">{[expense.customer?.name, expense.job?.title].filter(Boolean).join(" · ")}</p>
                  ) : null}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
