import { AuthShell } from "@/components/auth-shell";
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
    <AuthShell>
      <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-8">
        <h1 className="font-serif text-4xl tracking-tight">Check your email</h1>
        <p className="mt-3 leading-7 text-muted">
          If email is configured, the sign-in link is on its way. If it is not, the link is written to the server log.
        </p>
        {link ? (
          <p className="mt-6 border-l-4 border-pine pl-4 text-sm leading-6">
            Email is not configured on this machine. Use this link once:{" "}
            <a href={link} className="break-all font-semibold">Open the sign-in link</a>
          </p>
        ) : null}
        <a href="/login" className="mt-6 font-semibold">Back to sign in</a>
      </main>
    </AuthShell>
  );
}
