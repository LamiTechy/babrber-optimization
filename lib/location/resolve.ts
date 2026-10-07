import { lookup } from "node:dns/promises";
import {
  isGoogleMapsLink,
  isShortMapsLink,
  matchLandmark,
  parseCoordinates,
  parseMapsLink,
  type LandmarkCandidate,
  type LocationSource,
} from "./parse";

export type ResolveErrorCode = "empty" | "not-found" | "blocked";

export type ResolveOutcome =
  | { ok: true; lat: number; lng: number; source: LocationSource }
  | { ok: false; code: ResolveErrorCode; message: string };

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 5_000;

const ALLOWED_HOST = /(^|\.)(google\.[a-z]{2,3}(\.[a-z]{2})?|goo\.gl|g\.co|ggpht\.com)$/i;

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
      return true; // link-local
    }
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

/** Refuse to talk to loopback / RFC1918 / link-local addresses. */
async function assertPublicHost(hostname: string): Promise<void> {
  if (hostname === "localhost") throw new Error("blocked host");
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("blocked host");
  for (const entry of addresses) {
    if (isPrivateIp(entry.address)) throw new Error("blocked address");
  }
}

/**
 * Follow a Google short link (max 5 hops, 5s budget) with an allow-list of
 * Google domains so the resolver can never be pointed at an internal service.
 */
export async function resolveShortLink(input: string): Promise<string | null> {
  let current = input.trim();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      return null;
    }
    if (!ALLOWED_HOST.test(url.hostname)) return null;
    await assertPublicHost(url.hostname);

    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "text/html,application/xhtml+xml" },
      // Never send our own credentials to a third party.
      credentials: "omit",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = new URL(location, url).toString();
      continue;
    }

    if (response.ok) return url.toString();
    return null;
  }

  return null;
}

export function resolveInput(input: string, landmarks: LandmarkCandidate[]): ResolveOutcome {
  const value = input.trim();
  if (!value) {
    return { ok: false, code: "empty", message: "Type a place, paste a link, or drop a pin." };
  }

  if (isShortMapsLink(value)) {
    return {
      ok: false,
      code: "blocked",
      message: "That is a shortened link — use the full Google Maps link instead.",
    };
  }

  if (isGoogleMapsLink(value)) {
    const pair = parseMapsLink(value);
    if (pair) return { ok: true, ...pair, source: "maps-link" };
    return { ok: false, code: "not-found", message: "We could not read that Google Maps link." };
  }

  const coords = parseCoordinates(value);
  if (coords) return { ok: true, ...coords, source: "coords" };

  const landmark = matchLandmark(value, landmarks);
  if (landmark) return { ok: true, ...landmark, source: "landmark" };

  return {
    ok: false,
    code: "not-found",
    message: "We couldn't find that. Pick a landmark below or drop a pin.",
  };
}

/** Full server-side resolution: short links first, then the local parsers. */
export async function resolveLocation(
  input: string,
  landmarks: LandmarkCandidate[],
): Promise<ResolveOutcome> {
  const value = input.trim();
  if (!value) {
    return { ok: false, code: "empty", message: "Type a place, paste a link, or drop a pin." };
  }

  if (isShortMapsLink(value)) {
    try {
      const finalUrl = await resolveShortLink(value);
      if (finalUrl) {
        const pair = parseMapsLink(finalUrl);
        if (pair) return { ok: true, ...pair, source: "maps-link" };
      }
    } catch {
      /* falls through to the friendly message below */
    }
    return {
      ok: false,
      code: "not-found",
      message: "We couldn't open that short link. Try copying the full Google Maps link.",
    };
  }

  return resolveInput(value, landmarks);
}
