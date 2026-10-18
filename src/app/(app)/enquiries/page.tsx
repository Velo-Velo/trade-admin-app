import { redirect } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const enquiries = await prisma.enquiry.findMany({
    where: { traderId: user.trader.id },
    orderBy: { createdAt: "desc" },
    include: { quote: true, photos: { select: { id: true } } },
  });

  return (
    <div className="grid gap-4">
      <h1 className="font-serif text-4xl">Enquiries</h1>
      {enquiries.length === 0 ? (
        <p className="card text-sm text-muted">
          None yet. Share <a href={`/t/${user.trader.slug}`}>your page</a> or{" "}
          <a href="/quotes/new">start a quote</a> from a phone call.
        </p>
      ) : (
        <ul className="grid gap-3">
          {enquiries.map((enquiry) => (
            <li key={enquiry.id}>
              <a href={`/enquiries/${enquiry.id}`} className="card block no-underline">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{enquiry.customerName}</p>
                    <p className="text-sm text-muted">
                      {enquiry.postcode} · {formatDate(enquiry.createdAt)}
                      {enquiry.photos.length ? ` · ${enquiry.photos.length} photo${enquiry.photos.length === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  {enquiry.quote ? <StatusPill status={enquiry.quote.status} /> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{enquiry.jobDescription}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
