import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { DemoBanner } from "@/components/demo-banner";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { demoModeEnabled } from "@/lib/demo";
import { firstParam, safeNextPath } from "@/lib/format";
import { requestMagicLink, requestPasswordReset, signInDemo, signInWithPassword } from "@/server/auth-actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user?.trader) redirect("/dashboard");
  if (user) redirect("/onboarding");
  const query = await searchParams;
  const next = safeNextPath(firstParam(query.next));
  const demo = demoModeEnabled();

  return (
    <div>
      {demo ? <DemoBanner kind="mode" /> : null}
      <AuthShell>
        <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-8">
          <h1 className="font-serif text-4xl tracking-tight">Sign in</h1>
          <p className="mt-3 text-sm leading-6 text-muted">Use the email and password on the account, or ask for a one-time link.</p>
          <div className="mt-4">
            <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
          </div>
          <form action={signInDemo} className="mt-6 border-l-4 border-pine pl-4">
            <h2 className="font-semibold">Look around the sample business</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              A fictional plumbing and heating trader, kept separate from real accounts. Opening it resets only that sample. It does not send real emails, WhatsApp messages or payments.
            </p>
            <button className={`${buttonSecondary} mt-3`} type="submit">Try the demo</button>
          </form>
          <form action={signInWithPassword} className="mt-8 grid gap-4">
            <input type="hidden" name="next" value={next} />
            <label className={labelClass}>
              Email
              <input className={inputClass} name="email" type="email" autoComplete="email" required />
            </label>
            <label className={labelClass}>
              Password
              <input className={inputClass} name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className={buttonPrimary} type="submit">Sign in</button>
          </form>
          <form action={requestMagicLink} className="mt-8 grid gap-4 border-t border-sand pt-6">
            <h2 className="font-serif text-2xl tracking-tight">Email me a sign-in link</h2>
            <p className="text-sm text-muted">Use this if you have no password, or you have forgotten it. The link works once.</p>
            <label className={labelClass}>
              Email
              <input className={inputClass} name="email" type="email" autoComplete="email" required />
            </label>
            <button className={buttonSecondary} type="submit">Send link</button>
          </form>
          <form action={requestPasswordReset} className="mt-8 grid gap-4 border-t border-sand pt-6">
            <h2 className="font-serif text-2xl tracking-tight">Email me a password link</h2>
            <p className="text-sm text-muted">Sets a new password. The link works once.</p>
            <label className={labelClass}>
              Email
              <input className={inputClass} name="email" type="email" autoComplete="email" required />
            </label>
            <button className={buttonSecondary} type="submit">Send password link</button>
          </form>
          <p className="mt-6 text-sm">
            New here? <a href="/register">Create an account</a>
          </p>
        </main>
      </AuthShell>
    </div>
  );
}
