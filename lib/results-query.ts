import { DISTANCE_FILTERS } from "@/lib/config";

/** Filters that live in the results URL so results are shareable and SSR-friendly. */
export type ResultsFilters = {
  openNow: boolean;
  sort: "open" | "nearby";
  service: string | null;
  maxKm: number | null;
};

export type ResultsLocation = {
  lat: number;
  lng: number;
  label: string;
  source: string;
};

export const DEFAULT_FILTERS: ResultsFilters = {
  openNow: false,
  sort: "open",
  service: null,
  maxKm: null,
};

type Params = Record<string, string | string[] | undefined>;

function first(params: Params, key: string): string | null {
  const value = params[key];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === undefined || raw === "" ? null : raw;
}

function asCoordinate(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= 90 ? parsed : null;
}

export function parseLocation(params: Params): ResultsLocation | null {
  const lat = asCoordinate(first(params, "lat"));
  const lng = asCoordinate(first(params, "lng"));
  if (lat === null || lng === null) return null;
  return {
    lat,
    lng,
    label: first(params, "label") ?? "Chosen location",
    source: first(params, "src") ?? "unknown",
  };
}

export function parseFilters(params: Params): ResultsFilters {
  const service = first(params, "service");
  const distance = Number(first(params, "dist"));
  const maxKm = DISTANCE_FILTERS.find((value) => value === distance) ?? null;

  return {
    openNow: first(params, "open") === "1",
    sort: first(params, "sort") === "nearby" ? "nearby" : "open",
    service: service ? service.slice(0, 40) : null,
    maxKm,
  };
}

/** Serialises location + filters into one query string. */
export function resultsQueryString(
  location: ResultsLocation,
  filters: ResultsFilters = DEFAULT_FILTERS,
): string {
  const params = new URLSearchParams({
    lat: location.lat.toFixed(6),
    lng: location.lng.toFixed(6),
    label: location.label,
    src: location.source,
  });
  if (filters.openNow) params.set("open", "1");
  if (filters.sort === "nearby") params.set("sort", "nearby");
  if (filters.service) params.set("service", filters.service);
  if (filters.maxKm) params.set("dist", String(filters.maxKm));
  return params.toString();
}
