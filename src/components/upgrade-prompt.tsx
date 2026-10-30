import { upgradeMessage, upgradeTitle, type UpgradeFeature } from "@/lib/billing/plans";

export function UpgradePrompt({ feature }: { feature: UpgradeFeature }) {
  return (
    <aside className="card grid gap-2">
      <p className="font-semibold">{upgradeTitle(feature)}</p>
      <p className="text-sm leading-6 text-muted">{upgradeMessage(feature)}</p>
      <a href="/billing" className="text-sm font-semibold text-pine">
        Open Plans
      </a>
    </aside>
  );
}
