/** Shared API shapes (server → client). Keep these free of server imports. */

export type StatusState = "open" | "soon" | "closed" | "unknown";

export type StatusDto = {
  isOpen: boolean;
  state: StatusState;
  label: string;
  nextChange: string | null;
};

export type ServiceDto = {
  name: string;
  priceNaira: number;
  durationMinutes: number | null;
};

export type ShopHoursDayDto = {
  dayOfWeek: number;
  label: string;
  isToday: boolean;
  ranges: { open: string; close: string }[];
};

export type ShopCardDto = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  landmarkNote: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  whatsapp: string | null;
  coverImageUrl: string | null;
  amenities: string[];
  distanceMeters: number;
  distanceLabel: string;
  walkingMinutes: number;
  walkingLabel: string;
  status: StatusDto;
  priceFrom: number | null;
  services: ServiceDto[];
  lastVerifiedAt: string | null;
  hoursSource: "osm" | "manual" | "unknown";
};

export type ShopDetailDto = ShopCardDto & {
  description: string | null;
  images: string[];
  hours: ShopHoursDayDto[];
  osmOpeningHours: string | null;
  source: "osm" | "manual" | "sample";
  galleryCount: number;
};

export type NearbyResponse = {
  outsideArea: boolean;
  reference: { lat: number; lng: number };
  count: number;
  shops: ShopCardDto[];
};

export type ResolveResponse = {
  lat: number;
  lng: number;
  source: "maps-link" | "coords" | "landmark";
};

/* ------------------------------------------------------------------ *
 * Admin (server → client). Plain data only: no Date, no BigInt.
 * ------------------------------------------------------------------ */

export type AdminHoursRangeDto = { open: string; close: string };

export type AdminShopFormState = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  landmarkNote: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  whatsapp: string | null;
  amenities: string[];
  isPublished: boolean;
  isDeleted: boolean;
  source: "osm" | "manual" | "sample";
  hoursSource: "osm" | "manual" | "unknown";
  overrideStatus: "open" | "closed" | null;
  overrideUntil: string | null;
  lastVerifiedAt: string | null;
  hours: { dayOfWeek: number; ranges: AdminHoursRangeDto[] }[];
  services: { name: string; priceNaira: number; durationMinutes: number | null }[];
  images: { id: string; url: string }[];
};
