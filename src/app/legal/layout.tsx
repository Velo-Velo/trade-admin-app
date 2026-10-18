import { SiteFooter } from "@/components/site-footer";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-sand">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <a href="/" className="font-serif text-2xl tracking-tight no-underline">Quotestick</a>
          <a href="/login" className="text-sm font-semibold">Sign in</a>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
