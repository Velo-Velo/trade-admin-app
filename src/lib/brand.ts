export function foregroundFor(hex: string): "#1c1915" | "#fffdf9" {
  const raw = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return "#fffdf9";
  const channel = (start: number) => parseInt(raw.slice(start, start + 2), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(channel(1)) + 0.7152 * lin(channel(3)) + 0.0722 * lin(channel(5));
  return luminance > 0.45 ? "#1c1915" : "#fffdf9";
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "trade";
}

export function isHexColour(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
