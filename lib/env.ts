/** Small, explicit environment access — secrets never ship to the browser. */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function optionalEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Sample shops exist for demos only; set SHOW_SAMPLES=true to show them. */
export function showSamples(): boolean {
  return process.env.SHOW_SAMPLES === "true";
}

export function overpassUrl(): string {
  return optionalEnv("OVERPASS_URL", "https://overpass-api.de/api/interpreter");
}

export function contactEmail(): string {
  return optionalEnv("CONTACT_EMAIL", "hello@example.com");
}

export function cronSecret(): string {
  return optionalEnv("CRON_SECRET", "");
}

/**
 * How far the OpenStreetMap import looks for shops, in kilometres.
 * Widen this to pull in a bigger share of Abeokuta (Overpass coverage near
 * Ojere is thin); the site still shows real distances from each user.
 */
export function osmSyncRadiusKm(): number {
  const parsed = Number(optionalEnv("OSM_SYNC_RADIUS_KM", "25"));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
}
