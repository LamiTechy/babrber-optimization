/**
 * Where the visitor said they are. Kept in this device only — the server
 * receives coordinates for a single request and never stores them.
 */

export type SavedLocation = {
  lat: number;
  lng: number;
  label: string;
  source: "coords" | "gps" | "maps-link" | "landmark" | "pin";
  savedAt: number;
};

const STORAGE_KEY = "gentry:location";

export function readLocation(): SavedLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLocation;
    if (typeof parsed?.lat !== "number" || typeof parsed?.lng !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocation(location: Omit<SavedLocation, "savedAt">): SavedLocation {
  const saved: SavedLocation = { ...location, savedAt: Date.now() };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* private mode / quota — the session still works from the URL */
    }
  }
  return saved;
}

export function clearLocation(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Query string used when jumping from a location to the results page. */
export function locationQuery(location: SavedLocation): string {
  const params = new URLSearchParams({
    lat: location.lat.toFixed(6),
    lng: location.lng.toFixed(6),
    label: location.label,
    src: location.source,
  });
  return params.toString();
}
