"use client";

import { usePathname } from "next/navigation";

export function AppNav({ slug, showSimulator }: { slug: string; showSimulator: boolean }) {
  const pathname = usePathname();
  const links = [
    ["/dashboard", "Dashboard"],
    ["/enquiries", "Enquiries"],
    ["/quotes", "Quotes"],
    ["/follow-ups", "Follow-ups"],
    ["/invoices", "Invoices"],
    ["/jobs", "Jobs"],
    ["/rams", "RAMS"],
    ["/customers", "Customers"],
    ["/price-book", "Price book"],
    ["/checklist", "Checklist"],
    ["/business", "Your page"],
    ["/billing", "Plans"],
    ["/account", "Account"],
    ...(showSimulator ? [["/whatsapp", "WhatsApp"]] : []),
  ];
  return (
    <header className="border-b border-sand bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <a href="/dashboard" className="font-serif text-2xl tracking-tight text-ink no-underline">
          Quotestick
        </a>
        <a href={`/t/${slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-pine">
          View your page
        </a>
      </div>
      <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 pb-3" aria-label="Account">
        {links.map(([href, label]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <a
              key={href}
              href={href}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold no-underline ${
                active ? "bg-pine text-white" : "text-muted hover:bg-paper hover:text-ink"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
