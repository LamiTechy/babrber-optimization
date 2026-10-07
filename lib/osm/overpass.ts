import { contactEmail, overpassUrl, optionalEnv } from "@/lib/env";

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  /** Overpass calls this field `lon` — not `lng`. */
  lon?: number;
  lng?: number;
  center?: { lat: number; lon?: number; lng?: number };
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  elements: OverpassElement[];
};

const FALLBACK_URL = "https://overpass.kumi.systems/api/interpreter";
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 2;

/** Descriptive User-Agent — Overpass etiquette requires a contact address. */
export function userAgent(): string {
  return `Gentry/1.0 (hyper-local barber directory for Ojere, Abeokuta; contact: ${contactEmail()})`;
}

/** Substitutes the service-area values into the fixed Overpass query. */
export function buildOverpassQuery(radiusM: number, lat: number, lng: number): string {
  return [
    "[out:json][timeout:25];",
    "(",
    `  nwr["shop"="hairdresser"](around:${radiusM},${lat},${lng});`,
    `  nwr["shop"="barber"](around:${radiusM},${lat},${lng});`,
    `  nwr["amenity"="barber"](around:${radiusM},${lat},${lng});`,
    `  nwr["craft"="barber"](around:${radiusM},${lat},${lng});`,
    ");",
    "out center tags;",
  ].join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableError(message: string): Error & { retryable?: boolean } {
  const error = new Error(message) as Error & { retryable?: boolean };
  error.retryable = true;
  return error;
}

async function parseBody(response: Response): Promise<OverpassResponse> {
  const json = (await response.json()) as OverpassResponse;
  if (!json || !Array.isArray(json.elements)) {
    throw new Error("Overpass returned an unexpected payload");
  }
  return json;
}

/** POST (the documented form) with a GET fallback for picky mirrors. */
async function request(endpoint: string, query: string): Promise<OverpassResponse> {
  const headers = { "user-agent": userAgent(), accept: "application/json,*/*" };

  const post = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams({ data: query }).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (post.ok) return parseBody(post);

  if (post.status !== 406 && post.status !== 405 && post.status !== 415) {
    if (post.status === 429 || post.status === 504 || post.status === 503) {
      throw retryableError(`Overpass temporarily unavailable (${post.status})`);
    }
    throw new Error(`Overpass responded ${post.status}`);
  }

  const get = await fetch(`${endpoint}?${new URLSearchParams({ data: query })}`, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (get.ok) return parseBody(get);
  if (get.status === 429 || get.status === 504 || get.status === 503) {
    throw retryableError(`Overpass temporarily unavailable (${get.status})`);
  }
  throw new Error(`Overpass responded ${get.status}`);
}

export class OverpassUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverpassUnavailableError";
  }
}

/**
 * Queries Overpass with backoff on rate limits, falling back to a public
 * mirror when the primary endpoint fails.
 */
export async function queryOverpass(query: string): Promise<OverpassElement[]> {
  const primary = overpassUrl();
  const mirror = optionalEnv("OVERPASS_MIRROR_URL", FALLBACK_URL);
  const endpoints = primary === mirror ? [primary] : [primary, mirror];

  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await request(endpoint, query);
        return result.elements;
      } catch (error) {
        lastError = error;
        const retryable =
          (error as Error & { retryable?: boolean }).retryable === true ||
          (error instanceof Error && /timeout|timed out|unavailable/i.test(error.message));
        if (!retryable || attempt === MAX_ATTEMPTS) break;
        // 2s, then 5s — be a polite citizen of the shared endpoint.
        await sleep(attempt === 1 ? 2_000 : 5_000);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Overpass query failed";
  throw new OverpassUnavailableError(`OpenStreetMap is not responding right now (${message}).`);
}
