"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "sans-serif", margin: 0, padding: "4rem 1.25rem", background: "#f4f5f2", color: "#16181d" }}>
        <main>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9f2d00" }}>Quotestick</p>
          <h1 style={{ fontSize: "2rem", margin: "0.75rem 0" }}>Something went wrong</h1>
          <p>The page could not be shown. {error.digest ? `Reference ${error.digest}.` : ""}</p>
          <button type="button" onClick={() => reset()} style={{ marginTop: "1.5rem", fontWeight: 700 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
