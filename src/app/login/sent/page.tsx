import { firstParam } from "@/lib/format";

export const metadata = { title: "Check your email", robots: { index: false, follow: false } };

export default async function MagicSentPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const query = await searchParams;
  const link = firstParam(query.link);

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-serif text-4xl">Check your email</h1>
      <p className="mt-3 text-muted">
        If email is configured, the sign-in link is on its way. If it is not, the link is written to the server log.
      </p>
      {link ? (
        <p className="mt-6 rounded-xl border border-sand bg-card p-4 text-sm">
          Email is not configured on this machine. Use this link once:{" "}
          <a href={link} className="break-all font-semibold">
            Open the sign-in link
          </a>
        </p>
      ) : null}
      <a href="/login" className="mt-6 font-semibold text-pine">
        Back to sign in
      </a>
    </main>
  );
}
