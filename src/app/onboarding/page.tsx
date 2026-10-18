import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { OnboardingForm } from "@/components/onboarding-form";
import { getCurrentUser } from "@/lib/auth";
import { firstParam } from "@/lib/format";

export const metadata = { title: "Set up your business", robots: { index: false, follow: false } };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.trader) redirect("/dashboard");
  const query = await searchParams;

  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-10">
      <a href="/" className="font-serif text-2xl tracking-tight no-underline">Quotestick</a>
      <h1 className="mt-8 font-serif text-4xl tracking-tight">Set up your page</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        This creates a public page for your business. You can change it later. A text logo is enough.
      </p>
      <div className="mt-4">
        <Flash error={firstParam(query.error)} />
      </div>
      <div className="mt-6">
        <OnboardingForm />
      </div>
    </main>
  );
}
