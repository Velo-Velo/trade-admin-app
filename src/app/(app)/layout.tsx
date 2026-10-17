import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.trader) redirect("/onboarding");
  return (
    <div className="min-h-screen">
      <AppNav slug={user.trader.slug} />
      <main id="main" className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
