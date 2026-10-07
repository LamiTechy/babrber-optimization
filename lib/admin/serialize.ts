import type { AdminShopDetail } from "@/lib/data/admin-shops";
import type { AdminShopFormState } from "@/lib/types";

/**
 * Strips the database types (Date, BigInt) out of a shop row so the React
 * server can hand it to a client component.
 */
export function toAdminShopFormState(shop: AdminShopDetail): AdminShopFormState {
  return {
    id: shop.id,
    name: shop.name,
    description: shop.description,
    address: shop.address,
    landmarkNote: shop.landmarkNote,
    lat: shop.lat,
    lng: shop.lng,
    phone: shop.phone,
    whatsapp: shop.whatsapp,
    amenities: shop.amenities,
    isPublished: shop.isPublished,
    isDeleted: shop.isDeleted,
    source: shop.source,
    hoursSource: shop.hoursSource,
    overrideStatus: shop.overrideStatus,
    overrideUntil: shop.overrideUntil ? shop.overrideUntil.toISOString() : null,
    lastVerifiedAt: shop.lastVerifiedAt ? shop.lastVerifiedAt.toISOString() : null,
    hours: shop.hours.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      ranges: day.ranges.map((range) => ({ open: range.open, close: range.close })),
    })),
    services: shop.servicesList.map((service) => ({
      name: service.name,
      priceNaira: service.priceNaira,
      durationMinutes: service.durationMinutes ?? null,
    })),
    images: shop.images.map((image) => ({ id: image.id, url: image.url })),
  };
}
