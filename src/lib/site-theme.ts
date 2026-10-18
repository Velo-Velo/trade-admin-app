export const SITE_THEMES = ["yard", "ink", "signal"] as const;
export type SiteTheme = (typeof SITE_THEMES)[number];

export const SITE_THEME_CHOICES: Array<{ id: SiteTheme; label: string; detail: string }> = [
  {
    id: "yard",
    label: "Yard",
    detail: "Light page. Your business name sits at the top, and your colour is on the quote button.",
  },
  {
    id: "ink",
    label: "Ink",
    detail: "A dark header band with your name, then a light page for the work.",
  },
  {
    id: "signal",
    label: "Signal",
    detail: "Your colour runs down the side on a wide screen, and across the top on a phone.",
  },
];

export function siteTheme(value: string | null | undefined): SiteTheme {
  if (value === "ink" || value === "signal" || value === "yard") return value;
  return "yard";
}
