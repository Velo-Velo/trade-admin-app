import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { displayPhone, searchNeedles } from "@/lib/customers/match";
import { prisma } from "@/lib/db";
import { firstParam } from "@/lib/format";

export const metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const query = await searchParams;
  const q = (firstParam(query.q) ?? "").trim();
  const needles = searchNeedles(q);
  const customers = await prisma.customer.findMany({
    where: {
      traderId: user.trader.id,
      ...(needles.length
        ? { AND: needles.map((needle) => ({ searchText: { contains: needle, mode: "insensitive" as const } })) }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 50,
    include: { _count: { select: { jobs: true, quotes: true, invoices: true } } },
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div>
        <h1 className="font-serif text-4xl">Customers</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Search by name, phone, email, postcode or address. A few letters is enough.
        </p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <form className="grid gap-3" action="/customers">
        <label className={labelClass}>
          Search
          <input className={inputClass} name="q" defaultValue={q} placeholder="Name, phone, email, postcode or address" autoComplete="off" />
        </label>
        <button className={`${buttonPrimary} w-full sm:w-auto`} type="submit">Search</button>
      </form>
      {customers.length === 0 ? (
        <p className="card text-sm text-muted">{q ? "No customer matches that search." : "No customers yet. They appear when you take an enquiry, invoice or job."}</p>
      ) : (
        <ul className="grid gap-3">
          {customers.map((customer) => (
            <li key={customer.id}>
              <a href={`/customers/${customer.id}`} className="card block no-underline">
                <p className="font-semibold text-ink">{customer.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {[displayPhone(customer.phone), customer.email, customer.postcode, customer.address].filter(Boolean).join(" · ") || "No contact details yet"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {customer._count.jobs} jobs · {customer._count.quotes} quotes · {customer._count.invoices} invoices
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
