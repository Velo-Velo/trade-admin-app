import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { Flash } from "@/components/flash";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { firstParam } from "@/lib/format";
import { resetPassword } from "@/server/auth-actions";

export const metadata: Metadata = { title: "New password", robots: { index: false, follow: false } };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const query = await searchParams;
  const token = firstParam(query.token);

  return (
    <AuthShell>
      <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-8">
        <h1 className="font-serif text-4xl tracking-tight">Set a new password</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Use at least 8 characters. This link works once.</p>
        <div className="mt-4">
          <Flash error={firstParam(query.error)} />
        </div>
        {token ? (
          <form action={resetPassword} className="mt-6 grid gap-4">
            <input type="hidden" name="token" value={token} />
            <label className={labelClass}>
              New password
              <input className={inputClass} name="password" type="password" autoComplete="new-password" required minLength={8} />
            </label>
            <button className={buttonPrimary} type="submit">Save password</button>
          </form>
        ) : (
          <p className="mt-6 text-sm">That link is missing a token. Ask for a new one from the sign-in page.</p>
        )}
      </main>
    </AuthShell>
  );
}
