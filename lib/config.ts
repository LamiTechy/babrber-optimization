/**
 * Public, client-safe site configuration.
 * Everything the brand says about itself lives here — name, tagline and the
 * single service area we cover at launch. Never put secrets in this file.
 */

export const SITE_NAME = "Gentry";
export const SITE_TAGLINE = "Sharp cuts, close by.";

/** Default description used when a page does not provide its own. */
export const SITE_DESCRIPTION =
  `${SITE_TAGLINE} Find the nearest barber shops in Ojere, Abeokuta — open now, with prices, services and phone numbers.`;

/** Brand colours (mirrored in app/globals.css as CSS variables). */
export const BRAND_COLORS = {
  charcoal: "#1C1917",
  gold: "#C8A24A",
} as const;

/** The only area we support at launch. */
export const SERVICE_AREA = {
  name: "Ojere",
  city: "Abeokuta",
  state: "Ogun State",
  country: "Nigeria",
  // Ojere City centre: between MAPOLY (7.1011, 3.3296) and the TREM Ojere
  // reference (7.1090, 3.3348) — confirmed against real Google Maps pins of
  // the directory shops (all fall within 2.4 km of this point).
  centerLat: 7.114,
  centerLng: 3.333,
} as const;

/** Radius of the service area in kilometres (single constant). */
export const SERVICE_AREA_RADIUS_KM = 2.5;

/** `LatLon` view of the service-area centre, for the geo helpers. */
export const SERVICE_AREA_CENTER: { lat: number; lng: number } = {
  lat: SERVICE_AREA.centerLat,
  lng: SERVICE_AREA.centerLng,
};

/** IANA timezone all opening hours are evaluated in. */
export const SITE_TIMEZONE = "Africa/Lagos";

/** Walking speed used for the ETA shown under each distance. */
export const WALK_SPEED_KMH = 5;

/** Minimum tap target size in px (WCAG 2.5.5 / mobile ergonomics). */
export const TAP_TARGET_PX = 44;

/** Max number of gallery images shown on a shop page. */
export const MAX_SHOP_IMAGES = 8;

/** Filter options shown on the search page. */
export const SERVICE_FILTERS = [
  "haircut",
  "beard trim",
  "kids cut",
  "dreadlocks",
  "shaving",
  "hair dye",
] as const;

export const DISTANCE_FILTERS = [0.5, 1, 2] as const;

/** OSM attribution required by the ODbL licence. */
export const OSM_ATTRIBUTION = "Map data © OpenStreetMap contributors";
export const OSM_ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright";

/** Comfortable link for sharing the site (WhatsApp, OG, etc). */
export function siteUrl(path = "/"): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
