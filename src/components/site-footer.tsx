export function SiteFooter() {
  return (
    <footer className="border-t border-sand">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl tracking-tight">Quotestick</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
            Quotes, invoices and a one-page site for UK trades. A working name. Not legal or tax advice.
          </p>
        </div>
        <div className="text-sm leading-7">
          <p className="font-semibold">Product</p>
          <a className="block" href="/#pricing">Prices</a>
          <a className="block" href="/register">Create account</a>
          <a className="block" href="/login">Sign in</a>
        </div>
        <div className="text-sm leading-7">
          <p className="font-semibold">Legal</p>
          <a className="block" href="/legal/privacy">Privacy</a>
          <a className="block" href="/legal/terms">Terms</a>
          <a className="block" href="/legal/cookies">Cookies</a>
        </div>
      </div>
    </footer>
  );
}
