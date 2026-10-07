import type { LatLon } from "@/lib/geo";

export type LocationSource = "maps-link" | "coords" | "landmark";

export type ResolvedLocation = LatLon & { source: LocationSource };

export type LandmarkCandidate = {
  name: string;
  aliases?: string[] | null;
  lat: number;
  lng: number;
};

const COORD_PAIR = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;

function validPair(a: number, b: number): LatLon | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

/**
 * `7.1475, 3.3619`. Decimals are required so plain addresses are not mistaken
 * for coordinates. Pairs written the wrong way round (latitude second) are
 * corrected — every supported location has latitude > longitude.
 */
export function parseCoordinates(input: string): LatLon | null {
  const match = COORD_PAIR.exec(input.trim());
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const direct = validPair(first, second);
  if (!direct) return null;
  if (Math.abs(first) <= 90 && Math.abs(second) <= 90 && first < second) {
    return { lat: second, lng: first };
  }
  return direct;
}

const GOOGLE_HOST = /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/i;
const SHORT_HOST = /(^|\.)(maps\.app\.goo\.gl|goo\.gl)$/i;

function toUrl(input: string): URL | null {
  const value = input.trim();
  if (!value) return null;
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
}

export function isGoogleMapsLink(input: string): boolean {
  const url = toUrl(input);
  if (!url || !/^(https?:\/\/|www\.)/i.test(input.trim())) return false;
  const host = url.hostname;
  if (SHORT_HOST.test(host)) return true;
  if (!GOOGLE_HOST.test(host)) return false;
  if (/^maps\./i.test(host)) return true;
  return /\/maps\b/i.test(url.pathname);
}

/** `maps.app.goo.gl/...` or `goo.gl/...` — must be resolved server-side. */
export function isShortMapsLink(input: string): boolean {
  const url = toUrl(input);
  if (!url) return false;
  return url.hostname === "maps.app.goo.gl" || url.hostname === "goo.gl";
}

/**
 * Pull coordinates out of any Google Maps URL shape: `/@lat,lng`,
 * `!3dLAT!4dLNG`, `?q=lat,lng`, `?ll=lat,lng`, `?center=`, `?destination=`.
 */
export function parseMapsLink(input: string): LatLon | null {
  const value = input.trim();

  const atMatch = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/.exec(value);
  if (atMatch) {
    const pair = validPair(Number(atMatch[1]), Number(atMatch[2]));
    if (pair) return pair;
  }

  const placeMatch = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/.exec(value);
  if (placeMatch) {
    const pair = validPair(Number(placeMatch[1]), Number(placeMatch[2]));
    if (pair) return pair;
  }

  const url = toUrl(value);
  if (url) {
    for (const key of ["q", "ll", "center", "query", "destination"]) {
      const raw = url.searchParams.get(key);
      if (!raw) continue;
      const pair = parseCoordinates(raw);
      if (pair) return pair;
      // Nested URL, but never recurse on ourselves.
      if (/^https?:\/\//i.test(raw) && raw !== value) {
        const nested = parseMapsLink(raw);
        if (nested) return nested;
      }
    }
    const pathCoords = parseCoordinates(decodeURIComponent(url.pathname));
    if (pathCoords) return pathCoords;
  }

  return null;
}

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sørensen–Dice coefficient over bigrams — cheap and good enough for names. */
export function similarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const bigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const gram = s.slice(i, i + 2);
      out.set(gram, (out.get(gram) ?? 0) + 1);
    }
    return out;
  };

  const a2 = bigrams(left);
  const b2 = bigrams(right);
  let hits = 0;
  let totalA = 0;
  let totalB = 0;
  for (const count of a2.values()) totalA += count;
  for (const count of b2.values()) totalB += count;
  for (const [gram, count] of a2) hits += Math.min(count, b2.get(gram) ?? 0);
  return (2 * hits) / (totalA + totalB);
}

/**
 * Case-insensitive fuzzy match of typed text against the landmark list:
 * exact name, exact alias, containment, then similarity.
 */
export function matchLandmark(
  query: string,
  landmarks: LandmarkCandidate[],
): LatLon | null {
  const q = normalizeText(query);
  if (!q) return null;

  let best: { score: number; landmark: LandmarkCandidate } | null = null;

  for (const landmark of landmarks) {
    const names = [landmark.name, ...(landmark.aliases ?? [])];
    let score = 0;
    for (const name of names) {
      const n = normalizeText(name);
      if (!n) continue;
      if (n === q) score = Math.max(score, 1);
      else if (q.includes(n) || n.includes(q)) score = Math.max(score, 0.92);
      else score = Math.max(score, similarity(q, n));
    }
    if (score > 0 && (!best || score > best.score)) best = { score, landmark };
  }

  if (!best || best.score < 0.5) return null;
  return { lat: best.landmark.lat, lng: best.landmark.lng };
}
