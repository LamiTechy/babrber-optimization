import { SERVICE_AREA_RADIUS_KM, WALK_SPEED_KMH } from "@/lib/config";

export type LatLon = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres (Haversine). */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function haversineKm(a: LatLon, b: LatLon): number {
  return haversineMeters(a, b) / 1000;
}

/** `350 m` under a kilometre, `1.4 km` above it. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Walking time in minutes at 5 km/h (83.3 m per minute). */
export function walkingMinutes(meters: number, speedKmh: number = WALK_SPEED_KMH): number {
  const metresPerMinute = (speedKmh * 1000) / 60;
  return Math.max(1, Math.round(meters / metresPerMinute));
}

export function formatWalkingTime(meters: number): string {
  const mins = walkingMinutes(meters);
  return `${mins} min walk`;
}

/** Is the point inside the circular service area? */
export function isWithinArea(
  point: LatLon,
  center: LatLon,
  radiusKm: number = SERVICE_AREA_RADIUS_KM,
): boolean {
  return haversineMeters(point, center) <= radiusKm * 1000;
}

export function distanceFromArea(point: LatLon, center: LatLon): number {
  return haversineMeters(point, center);
}

export function isValidLat(lat: unknown): lat is number {
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLng(lng: unknown): lng is number {
  return typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
