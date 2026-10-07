import type { ShopCardDto } from "@/lib/types";

/** `tel:` link that survives pasted spacing. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** wa.me link using the international number without the leading `+`. */
export function whatsappHref(whatsapp: string, message?: string): string {
  const digits = whatsapp.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** Turn-by-turn directions that open in the visitor's maps app of choice. */
export function directionsUrl(location: { lat: number; lng: number; name?: string }): string {
  const query = location.name
    ? `${location.name}@${location.lat},${location.lng}`
    : `${location.lat},${location.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=walking`;
}

/** A read-only map pin URL (used for “open in maps” style links). */
export function pinUrl(location: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
}

export function callMessage(shop: ShopCardDto): string {
  return `Hi ${shop.name}, I found you on Gentry. Are you open right now?`;
}
