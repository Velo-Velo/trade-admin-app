/**
 * Nearest 24-hour A&E suggestion.
 * NHS Service Search (api.nhs.uk) answers 401 without a subscription key, so this
 * uses postcodes.io for the location and OpenStreetMap Nominatim for hospitals
 * tagged emergency=yes. Both are free and need no key. Results are cached.
 * A failure leaves the field for the trader to type.
 */

export type AeSuggestion = {
  name: string;
  distanceMiles: number;
  address: string;
};

export type AeLookup =
  | { ok: true; postcode: string; suggestions: AeSuggestion[] }
  | { ok: false; reason: string };

const OK_MS = 24 * 60 * 60 * 1000;
const FAIL_MS = 2 * 60 * 1000;
const USER_AGENT = "Quotestick/1.0 (nearest A&E lookup for a RAMS; https://github.com/Velo-Velo/trade-admin-app)";

const cache = new Map<string, { at: number; value: AeLookup }>();

export function clearAeCache(): void {
  cache.clear();
}

export function normalisePostcode(value: string): string | null {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function haversineMiles(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const radius = 3958.8;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLon = ((toLon - fromLon) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatMiles(miles: number): string {
  const rounded = Math.round(miles * 10) / 10;
  const shown = rounded < 0.1 ? 0.1 : rounded;
  return `${shown.toFixed(1)} miles`;
}

export function hospitalSearchUrl(lat: number, lon: number, span = 0.45): string {
  const left = lon - span;
  const right = lon + span;
  const top = lat + span * 0.7;
  const bottom = lat - span * 0.7;
  const params = new URLSearchParams({
    format: "jsonv2",
    amenity: "hospital",
    countrycodes: "gb",
    limit: "40",
    extratags: "1",
    bounded: "1",
    viewbox: `${left},${top},${right},${bottom}`,
  });
  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}

type NominatimRow = {
  name?: string;
  lat?: string;
  lon?: string;
  display_name?: string;
  extratags?: { emergency?: string };
};

export function suggestionsFromHospitals(
  originLat: number,
  originLon: number,
  rows: NominatimRow[],
): AeSuggestion[] {
  const ranked = rows
    .map((row) => {
      const lat = Number(row.lat);
      const lon = Number(row.lon);
      const name = (row.name || "").trim();
      if (!name || row.extratags?.emergency !== "yes" || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const address = (row.display_name || "")
        .split(",")
        .slice(0, 3)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ");
      return { name, address, distanceMiles: haversineMiles(originLat, originLon, lat, lon) };
    })
    .filter((row): row is AeSuggestion => Boolean(row))
    .sort((a, b) => a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const unique: AeSuggestion[] = [];
  for (const row of ranked) {
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length === 3) break;
  }
  return unique;
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`Lookup responded ${response.status}`);
  return response.json();
}

export async function lookupNearestAe(
  postcode: string,
  deps?: { fetch?: typeof fetch; now?: () => number },
): Promise<AeLookup> {
  const fetchImpl = deps?.fetch ?? fetch;
  const now = deps?.now ?? Date.now;
  const normalised = normalisePostcode(postcode);
  if (!normalised) return { ok: false, reason: "Enter a UK postcode to suggest the nearest A&E." };
  const hit = cache.get(normalised);
  if (hit && now() - hit.at < (hit.value.ok ? OK_MS : FAIL_MS)) return hit.value;

  const fail = (reason: string): AeLookup => {
    const value: AeLookup = { ok: false, reason };
    cache.set(normalised, { at: now(), value });
    return value;
  };

  try {
    const geoResponse = await fetchImpl(`https://api.postcodes.io/postcodes/${encodeURIComponent(normalised.replace(/\s/g, ""))}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(4000),
    });
    const geo = (await readJson(geoResponse)) as { result?: { latitude?: number; longitude?: number } };
    const lat = geo.result?.latitude;
    const lon = geo.result?.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") return fail("That postcode could not be located. Type the nearest A&E.");

    let suggestions: AeSuggestion[] = [];
    for (const span of [0.45, 1.2]) {
      const response = await fetchImpl(hospitalSearchUrl(lat, lon, span), {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(4000),
      });
      const rows = (await readJson(response)) as NominatimRow[];
      suggestions = suggestionsFromHospitals(lat, lon, Array.isArray(rows) ? rows : []);
      if (suggestions.length > 0) break;
    }
    if (suggestions.length === 0) return fail("No emergency hospital was found near that postcode. Type the nearest A&E.");
    const value: AeLookup = { ok: true, postcode: normalised, suggestions };
    cache.set(normalised, { at: now(), value });
    return value;
  } catch {
    return fail("The hospital lookup is unavailable. Type the nearest A&E.");
  }
}
