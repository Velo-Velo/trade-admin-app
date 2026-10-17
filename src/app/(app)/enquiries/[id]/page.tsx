import { notFound, redirect } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { buttonPrimary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contactHref, formatDate } from "@/lib/format";

export const metadata = { title: "Enquiry" };

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.trader) redirect("/onboarding");
  const { id } = await params;
  const enquiry = await prisma.enquiry.findFirst({
    where: { id, traderId: user.trader.id },
    include: { quote: true, photos: { select: { id: true, filename: true } } },
  });
  if (!enquiry) notFound();
  const href = contactHref(enquiry.contact);

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">{enquiry.customerName}</h1>
          <p className="mt-2 text-sm text-muted">
            {formatDate(enquiry.createdAt)} · {enquiry.source === "website" ? "From your page" : "Entered by you"}
          </p>
        </div>
        {enquiry.quote ? <StatusPill status={enquiry.quote.status} /> : null}
      </div>
      <section className="card grid gap-2 text-sm">
        <p>
          Contact:{" "}
          {href ? <a href={href}>{enquiry.contact}</a> : enquiry.contact}
        </p>
        <p>Postcode: {enquiry.postcode}</p>
        <p className="whitespace-pre-wrap leading-6">{enquiry.jobDescription}</p>
      </section>
      {enquiry.photos.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {enquiry.photos.map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-2xl border border-sand bg-white">
              <img src={`/api/photos/${photo.id}`} alt={photo.filename} className="h-56 w-full object-cover" />
            </figure>
          ))}
        </section>
      ) : null}
      {enquiry.quote ? (
        <a href={`/quotes/${enquiry.quote.id}`} className={`${buttonPrimary} no-underline`}>
          Open draft quote
        </a>
      ) : null}
    </div>
  );
}
