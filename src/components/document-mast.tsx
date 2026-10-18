import { foregroundFor } from "@/lib/brand";
import { siteTheme, type SiteTheme } from "@/lib/site-theme";

export function DocumentMast({
  theme,
  brand,
  name,
  kicker,
}: {
  theme: string;
  brand: string;
  name: string;
  kicker: string;
}) {
  const resolved: SiteTheme = siteTheme(theme);
  const onBrand = foregroundFor(brand);
  if (resolved === "ink") {
    return (
      <header className="border-t-[6px] bg-[#16181d] text-white" style={{ borderTopColor: brand }}>
        <div className="mx-auto max-w-3xl px-5 py-8">
          <p className="text-sm font-semibold tracking-wide text-white/70">{kicker}</p>
          <p className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">{name}</p>
        </div>
      </header>
    );
  }
  if (resolved === "signal") {
    return (
      <header style={{ background: brand, color: onBrand }}>
        <div className="mx-auto max-w-3xl px-5 py-8">
          <p className="text-sm font-semibold tracking-wide opacity-80">{kicker}</p>
          <p className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">{name}</p>
        </div>
      </header>
    );
  }
  return (
    <header className="border-b-[6px] bg-white" style={{ borderBottomColor: brand }}>
      <div className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm font-semibold tracking-wide text-muted">{kicker}</p>
        <p className="mt-1 font-serif text-3xl tracking-tight text-ink sm:text-4xl">{name}</p>
      </div>
    </header>
  );
}
