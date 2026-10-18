import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DemoBanner } from "@/components/demo-banner";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { demoModeEnabled } from "@/lib/demo";
import { firstParam, safeNextPath } from "@/lib/format";
import { requestMagicLink, signInDemo, signInWithPassword } from "@/server/auth-actions";

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
    <div className="min-h-screen">
      {demo ? <DemoBanner kind="mode" /> : null}
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <a href="/" className="font-serif text-2xl no-underline">
        Quotestick
      </a>
      {demo ? (
        <form action={signInDemo} className="mt-6 rounded-2xl border border-sand bg-white p-4">
          <h2 className="font-serif text-2xl">Look around the sample business</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            A fictional plumbing and heating trader, with draft quotes ready to approve. No email provider or card payments are used.
          </p>
          <button className={`${buttonPrimary} mt-4`} type="submit">
            Try the demo
          </button>
        </form>
      ) : null}
      <h1 className="mt-6 font-serif text-4xl">Sign in</h1>
      <div className="mt-4">
        <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      </div>
      <form action={signInWithPassword} className="mt-6 grid gap-4">
        <input type="hidden" name="next" value={next} />
        <label className={labelClass}>
          Email
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
        </label>
        <label className={labelClass}>
          Password
          <input className={inputClass} name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className={buttonPrimary} type="submit">
          Sign in
        </button>
      </form>
      <form action={requestMagicLink} className="mt-8 grid gap-4 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">Email me a sign-in link</h2>
        <p className="text-sm text-muted">Use this if you have no password, or you have forgotten it. The link works once.</p>
        <label className={labelClass}>
          Email
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
        </label>
        <button className={buttonSecondary} type="submit">
          Send link
        </button>
      </form>
      <p className="mt-6 text-sm">
        New here? <a href="/register">Create an account</a>
      </p>
    </main>
    </div>
  );
}
