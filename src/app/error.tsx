"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest ?? "", source: "error-page" }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-pine">Quotestick</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-md leading-7 text-muted">The page could not be shown. Nothing was sent to a customer.</p>
      <button className="mt-6 w-fit font-semibold" type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
