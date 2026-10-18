import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Flash } from "@/components/flash";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { firstParam } from "@/lib/format";
import { registerAccount } from "@/server/auth-actions";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user?.trader) redirect("/dashboard");
  if (user) redirect("/onboarding");
  const query = await searchParams;

  return (
    <AuthShell>
      <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-8">
        <h1 className="font-serif text-4xl tracking-tight">Create an account</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Email and a password. The next screen asks for your business, trade and area. No card is taken.
        </p>
        <div className="mt-4">
          <Flash error={firstParam(query.error)} />
        </div>
        <form action={registerAccount} className="mt-6 grid gap-4">
          <label className={labelClass}>
            Email
            <input className={inputClass} name="email" type="email" autoComplete="email" required />
          </label>
          <label className={labelClass}>
            Password
            <input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className={buttonPrimary} type="submit">Create account</button>
        </form>
        <p className="mt-6 text-sm">
          Already registered? <a href="/login">Sign in</a>
        </p>
      </main>
    </AuthShell>
  );
}
