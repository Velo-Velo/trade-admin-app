import { AuthShell } from "@/components/auth-shell";
import { buttonPrimary } from "@/components/styles";
import { confirmMagicLink } from "@/server/auth-actions";

export const metadata = { title: "Confirm sign-in", robots: { index: false, follow: false } };

export default async function MagicPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const query = await searchParams;
  const token = query.token ?? "";

  return (
    <AuthShell>
      <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-8">
        <h1 className="font-serif text-4xl tracking-tight">Confirm sign-in</h1>
        <p className="mt-3 text-muted">This link is single use. Confirm to open your account.</p>
        {token ? (
          <form action={confirmMagicLink} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button className={buttonPrimary} type="submit">Sign in</button>
          </form>
        ) : (
          <p className="mt-6 text-sm">This link is missing a token. Request a new one from the sign-in page.</p>
        )}
      </main>
    </AuthShell>
  );
}
