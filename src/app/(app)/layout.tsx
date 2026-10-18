import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { DemoBanner } from "@/components/demo-banner";
import { getCurrentUser } from "@/lib/auth";
import { demoModeEnabled, isDemoEmail, isDemoSlug } from "@/lib/demo";

export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.trader) redirect("/onboarding");
  const sample = isDemoSlug(user.trader.slug) || isDemoEmail(user.email);
  return (
    <div className="min-h-screen">
      {sample ? <DemoBanner kind="sample" /> : null}
      <AppNav slug={user.trader.slug} showSimulator={demoModeEnabled()} />
      <main id="main" className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
