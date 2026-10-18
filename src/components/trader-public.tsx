import { DemoBanner } from "@/components/demo-banner";
import { Flash } from "@/components/flash";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { foregroundFor } from "@/lib/brand";
import type { WebsiteBadge } from "@/lib/checklist/catalog";
import { siteTheme, type SiteTheme } from "@/lib/site-theme";
import { telHref } from "@/lib/format";
import { submitEnquiry } from "@/server/enquiry-actions";

export type PublicPhoto = { id: string; kind: "BEFORE" | "AFTER" };

type TraderPublicProps = {
  theme: string;
  brand: string;
  businessName: string;
  tradeLabel: string;
  area: string;
  postcodes: string[];
  phone: string;
  intro: string;
  services: string[];
  slug: string;
  demo: boolean;
  error?: string;
  badges: WebsiteBadge[];
  photos: PublicPhoto[];
  reviewUrl: string;
};

export function TraderPublic(props: TraderPublicProps) {
  const theme = siteTheme(props.theme);
  const onBrand = foregroundFor(props.brand);
  return (
    <div className="min-h-screen">
      {props.demo ? <DemoBanner kind="sample" /> : null}
      <div className={theme === "signal" ? "lg:grid lg:grid-cols-[minmax(16rem,22rem)_1fr]" : ""}>
      <Mast {...props} theme={theme} onBrand={onBrand} />
      <div className={theme === "signal" ? "min-w-0" : ""}>
        <main id="main" className="mx-auto grid max-w-5xl gap-16 px-5 py-10 pb-28 sm:pb-16">
          <Intro {...props} />
          <Gallery photos={props.photos} demo={props.demo} businessName={props.businessName} />
          <Trust {...props} />
          <Enquiry {...props} />
        </main>
        <footer className="border-t border-sand px-5 py-6 text-sm text-muted">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <p>
              {props.businessName}
              {props.area ? ` · ${props.area}` : ""}
            </p>
            <p>
              <a href={telHref(props.phone)}>Call {props.phone}</a>
              <span className="px-2">·</span>
              <a href="/">Page by Quotestick</a>
            </p>
          </div>
        </footer>
      </div>
      <a
        href="#enquiry"
        className="fixed inset-x-4 bottom-4 z-20 flex min-h-11 items-center justify-center font-semibold no-underline shadow-card sm:hidden"
        style={{ background: props.brand, color: onBrand }}
      >
        Get a quote
      </a>
      </div>
    </div>
  );
}

function Mast(props: TraderPublicProps & { theme: SiteTheme; onBrand: string }) {
  const name = (
    <div>
      <p className={`text-sm font-semibold uppercase tracking-[0.14em] ${props.theme === "yard" ? "text-muted" : "opacity-80"}`}>
        {props.tradeLabel}
      </p>
      <h1 className="mt-2 font-serif text-4xl leading-none tracking-tight sm:text-6xl">{props.businessName}</h1>
      <p className="mt-3 text-lg">{props.area}</p>
    </div>
  );
  const quoteButton =
    props.theme === "signal"
      ? { background: props.onBrand, color: props.brand }
      : props.theme === "ink"
        ? { background: "#ffffff", color: "#16181d" }
        : { background: props.brand, color: props.onBrand };
  const actions = (
    <div className="flex flex-wrap gap-3">
      <a href="#enquiry" className="inline-flex min-h-11 items-center px-4 py-3 font-semibold no-underline" style={quoteButton}>
        Get a quote
      </a>
      <a href={telHref(props.phone)} className={`inline-flex min-h-11 items-center px-4 py-3 font-semibold no-underline ${props.theme === "yard" ? "border border-sand text-ink" : ""}`} style={props.theme === "yard" ? undefined : { color: "inherit" }}>
        Call {props.phone}
      </a>
    </div>
  );
  if (props.theme === "ink") {
    return (
      <header className="border-t-[8px] bg-[#16181d] text-white" style={{ borderTopColor: props.brand }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-6 px-5 py-10 sm:py-14">
          {name}
          {actions}
        </div>
      </header>
    );
  }
  if (props.theme === "signal") {
    return (
      <header className="px-6 py-8 text-white lg:sticky lg:top-0 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:py-10" style={{ background: props.brand, color: props.onBrand }}>
        {name}
        <div className="mt-6 lg:mt-0">{actions}</div>
      </header>
    );
  }
  return (
    <header className="border-b-[8px] bg-white" style={{ borderBottomColor: props.brand }}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-6 px-5 py-8 sm:py-12">
        {name}
        {actions}
      </div>
    </header>
  );
}

function Intro({ intro, services, postcodes, area }: TraderPublicProps) {
  return (
    <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div>
        <h2 className="font-serif text-3xl tracking-tight">The work</h2>
        <p className="mt-4 text-lg leading-8">{intro}</p>
        <p className="mt-4 text-sm leading-6 text-muted">
          {area}
          {postcodes.length > 0 ? ` · ${postcodes.join(", ")}` : ""}
        </p>
      </div>
      {services.length > 0 ? (
        <ul className="divide-y divide-sand border-y border-sand">
          {services.map((service) => (
            <li key={service} className="py-3 text-lg">
              {service}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Gallery({ photos, demo, businessName }: { photos: PublicPhoto[]; demo: boolean; businessName: string }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-serif text-3xl tracking-tight">Recent work</h2>
        {demo ? <p className="text-sm text-muted">Sample photographs. Not a real job.</p> : null}
      </div>
      {photos.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted">{businessName} has not published job photos on this page.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className={index === 0 ? "col-span-2 sm:col-span-2 sm:row-span-2" : ""}>
              <img
                src={`/api/site-photos/${photo.id}`}
                alt={photo.kind === "AFTER" ? "After the job" : "Before the job"}
                className={`w-full object-cover ${index === 0 ? "aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-64" : "aspect-square"}`}
              />
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{photo.kind === "AFTER" ? "After" : "Before"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Trust({ badges, reviewUrl, demo, businessName }: TraderPublicProps) {
  const hasReview = reviewUrl.startsWith("https://");
  return (
    <section className="grid gap-10 lg:grid-cols-2">
      <div>
        <h2 className="font-serif text-3xl tracking-tight">Reviews</h2>
        {hasReview ? (
          <p className="mt-4 leading-7">
            Reviews stay on Google. This page does not copy them.
            {demo ? " Sample link. Not a real review page." : ""}
          </p>
        ) : (
          <p className="mt-4 leading-7 text-muted">No review link has been added.</p>
        )}
        {hasReview ? (
          <a className="mt-4 inline-flex min-h-11 items-center font-semibold" href={reviewUrl} target="_blank" rel="noreferrer">
            Read reviews
          </a>
        ) : null}
      </div>
      <div>
        <h2 className="font-serif text-3xl tracking-tight">Accreditations</h2>
        {badges.length === 0 ? (
          <p className="mt-4 leading-7 text-muted">No registrations are published on this page.</p>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-muted">
              Entered by {businessName}. Quotestick has not checked these numbers.
            </p>
            <dl className="mt-4 divide-y divide-sand border-y border-sand">
              {badges.map((badge) => (
                <div key={`${badge.label}-${badge.reference}`} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-baseline">
                  <dt className="font-semibold">{badge.label}</dt>
                  <dd className="text-sm sm:text-right">
                    {badge.reference}
                    {badge.publicRegister ? (
                      <>
                        {" "}
                        <a href={badge.verifyUrl} target="_blank" rel="noreferrer">
                          Check the register
                        </a>
                      </>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </section>
  );
}

function Enquiry(props: TraderPublicProps) {
  return (
    <section id="enquiry" className="grid gap-6 border-t-[6px] border-[#16181d] pt-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]" style={{ borderTopColor: props.brand }}>
      <div>
        <h2 className="font-serif text-3xl tracking-tight">Get a quote</h2>
        <p className="mt-3 leading-7 text-muted">
          This sends {props.businessName} a draft. They check it before you receive a quote. You will not see a price on this page.
        </p>
      </div>
      <div>
        <Flash error={props.error} />
        <form action={submitEnquiry} className="mt-4 grid gap-4">
          <input type="hidden" name="slug" value={props.slug} />
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label>
              Company website
              <input name="company_website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className={labelClass}>
            Your name
            <input className={inputClass} name="customerName" required autoComplete="name" />
          </label>
          <label className={labelClass}>
            Email or mobile
            <input className={inputClass} name="contact" required autoComplete="email" />
          </label>
          <label className={labelClass}>
            Postcode
            <input className={inputClass} name="postcode" required autoComplete="postal-code" placeholder="SW1A 1AA" />
          </label>
          <label className={labelClass}>
            What needs doing?
            <textarea className={inputClass} name="jobDescription" required rows={5} />
          </label>
          <label className={labelClass}>
            Photos, if you have them
            <input className={inputClass} name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
          </label>
          <p className="text-sm text-muted">Up to 4 photos. JPG, PNG or WebP. 2 MB each.</p>
          <button className={buttonPrimary} type="submit">
            Send enquiry
          </button>
        </form>
      </div>
    </section>
  );
}
