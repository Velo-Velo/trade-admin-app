import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { buttonPrimary, buttonSecondary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { traderAccess } from "@/lib/billing/plans";
import { isSandboxTrader } from "@/lib/sandbox";
import { loadUpcomingReminders } from "@/lib/chasers/load";
import { ReminderList } from "@/components/reminder-list";
import { prisma } from "@/lib/db";
import { firstParam } from "@/lib/format";
import { dismissChase, sendChase } from "@/server/chase-actions";

export const metadata = { title: "Follow-ups" };

export default async function FollowUpsPage({
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
  const now = new Date();
  const upcoming = await loadUpcomingReminders(user.trader.id, now);
  const chases = await prisma.customerChase.findMany({
    where: { traderId: user.trader.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      quote: { select: { id: true, number: true, customerName: true } },
      job: { select: { id: true, title: true, customer: { select: { id: true, name: true } } } },
      serviceReminder: { select: { id: true, title: true, customerId: true, customer: { select: { name: true } } } },
    },
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div>
        <h1 className="font-serif text-4xl">Follow-ups</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Quote reminders and service invitations wait here until you tap Send.
          {user.trader.autoSendQuoteChasers
            ? " Auto-send is on, so new ones go out without this queue."
            : " Auto-send is off."}{" "}
          Change that on <a href="/business">Your page</a>.
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      {access.chasers ? null : <UpgradePrompt feature="chasers" />}
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Upcoming</h2>
        <ReminderList
          items={upcoming}
          now={now}
          remindWeeks={user.trader.serviceRemindWeeks}
          empty="No service reminders are due in the next 18 months."
        />
      </section>
      {chases.length === 0 ? (
        <p className="card text-sm leading-6 text-muted">
          Nothing is waiting. A sent quote with no reply, and a repeating service that is coming due, appear here for you to send.
        </p>
      ) : null}
      {chases.map((chase) => {
        const who = chase.quote?.customerName ?? chase.job?.customer.name ?? chase.serviceReminder?.customer.name ?? "Customer";
        const about = chase.kind === "QUOTE" ? `Quote ${chase.quote?.number ?? ""}`.trim() : chase.job?.title ?? chase.serviceReminder?.title ?? "Service";
        return (
          <article key={chase.id} className="card grid gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {chase.kind === "QUOTE" ? "Quote follow-up" : "Service reminder"}
              </p>
              <h2 className="mt-1 font-serif text-2xl">{chase.subject}</h2>
              <p className="mt-1 text-sm text-muted">
                {who} · {about}
                {chase.quote ? (
                  <>
                    {" "}
                    · <a href={`/quotes/${chase.quote.id}`}>Open quote</a>
                  </>
                ) : null}
                {chase.job ? (
                  <>
                    {" "}
                    · <a href={`/jobs/${chase.job.id}`}>Open job</a>
                  </>
                ) : null}
                {chase.serviceReminder ? (
                  <>
                    {" "}
                    · <a href={`/customers/${chase.serviceReminder.customerId}`}>Open customer</a>
                  </>
                ) : null}
              </p>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-ink">{chase.body}</pre>
            <div className="grid gap-2 sm:grid-cols-2">
              {access.chasers ? (
                <form action={sendChase}>
                  <input type="hidden" name="chaseId" value={chase.id} />
                  <button className={`${buttonPrimary} w-full`} type="submit">
                    Send
                  </button>
                </form>
              ) : null}
              <form action={dismissChase}>
                <input type="hidden" name="chaseId" value={chase.id} />
                <button className={`${buttonSecondary} w-full`} type="submit">
                  Dismiss
                </button>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}
