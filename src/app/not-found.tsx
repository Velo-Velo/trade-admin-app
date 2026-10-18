export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-pine">Quotestick</p>
      <h1 className="mt-2 font-serif text-4xl">That page is not available</h1>
      <p className="mt-3 text-muted">
        The link may be wrong, or a quote may still be a draft. Draft quotes stay private until the trader approves them.
      </p>
      <a href="/" className="mt-6 font-semibold text-pine">
        Back to the start
      </a>
    </main>
  );
}
