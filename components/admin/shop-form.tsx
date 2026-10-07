"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_SHOP_IMAGES, SERVICE_AREA_CENTER } from "@/lib/config";
import type { AdminShopFormState } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Details = {
  name: string;
  address: string;
  landmarkNote: string;
  description: string;
  lat: string;
  lng: string;
  phone: string;
  whatsapp: string;
  amenities: string;
  isPublished: boolean;
  hoursSource: "manual" | "unknown" | "osm";
  overrideStatus: "" | "open" | "closed";
  overrideUntil: string;
};

type Service = { name: string; priceNaira: string; durationMinutes: string };

type ImageItem = { id: string; url: string };

type HoursRange = { open: string; close: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error?: { message?: string } }
    | null;
  if (!response.ok || !payload || !payload.ok) {
    throw new Error(
      payload && !payload.ok ? (payload.error?.message ?? "Request failed.") : `Request failed (${response.status}).`,
    );
  }
  return payload.data;
}

function toDetails(shop: AdminShopFormState | null): Details {
  return {
    name: shop?.name ?? "",
    address: shop?.address ?? "",
    landmarkNote: shop?.landmarkNote ?? "",
    description: shop?.description ?? "",
    lat: String(shop?.lat ?? SERVICE_AREA_CENTER.lat),
    lng: String(shop?.lng ?? SERVICE_AREA_CENTER.lng),
    phone: shop?.phone ?? "",
    whatsapp: shop?.whatsapp ?? "",
    amenities: (shop?.amenities ?? []).join(", "),
    isPublished: shop?.isPublished ?? true,
    hoursSource: shop?.hoursSource ?? "manual",
    overrideStatus: shop?.overrideStatus ?? "",
    overrideUntil: shop?.overrideUntil ? toLocalInput(shop.overrideUntil) : "",
  };
}

function toLocalInput(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function toServices(shop: AdminShopFormState | null): Service[] {
  if (shop?.services.length) {
    return shop.services.map((service) => ({
      name: service.name,
      priceNaira: String(service.priceNaira),
      durationMinutes: service.durationMinutes == null ? "" : String(service.durationMinutes),
    }));
  }
  return [{ name: "Haircut", priceNaira: "1500", durationMinutes: "30" }];
}

function toWeek(shop: AdminShopFormState | null): HoursRange[][] {
  if (shop) return shop.hours.map((day) => [...day.ranges]);
  return Array.from({ length: 7 }, () => []);
}

function SaveBar({
  busy,
  message,
  error,
  onSave,
  label = "Save",
}: {
  busy: boolean;
  message: string | null;
  error: string | null;
  onSave: () => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
      <button type="button" className="btn btn-primary" onClick={onSave} disabled={busy}>
        {busy ? "Saving…" : label}
      </button>
      {message && <p className="text-sm text-open">{message}</p>}
      {error && (
        <p role="alert" className="text-sm text-closed">
          {error}
        </p>
      )}
    </div>
  );
}

export function ShopForm({ shop }: { shop: AdminShopFormState | null }) {
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(shop?.id ?? null);
  const [details, setDetails] = useState<Details>(() => toDetails(shop));
  const [week, setWeek] = useState<HoursRange[][]>(() => toWeek(shop));
  const [services, setServices] = useState<Service[]>(() => toServices(shop));
  const [images, setImages] = useState<ImageItem[]>(shop?.images ?? []);

  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string | null>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function report(section: string, message: string | null, error: string | null = null) {
    setMessages((current) => ({ ...current, [section]: message }));
    setErrors((current) => ({ ...current, [section]: error }));
  }

  function patchDetails(key: keyof Details, value: string | boolean) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  async function saveDetails() {
    setBusy("details");
    report("details", null);
    try {
      const lat = Number(details.lat);
      const lng = Number(details.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Latitude and longitude must be numbers, e.g. 7.1475, 3.3619.");
      }
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new Error("Coordinates look wrong: latitude -90..90, longitude -180..180.");
      }

      const body = {
        name: details.name.trim(),
        description: details.description.trim() || null,
        address: details.address.trim() || null,
        landmarkNote: details.landmarkNote.trim() || null,
        lat,
        lng,
        phone: details.phone.trim() || null,
        whatsapp: details.whatsapp.trim() || null,
        amenities: details.amenities
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 12),
        isPublished: details.isPublished,
        hoursSource: details.hoursSource,
        overrideStatus: details.overrideStatus === "" ? null : details.overrideStatus,
        overrideUntil: details.overrideUntil ? new Date(details.overrideUntil).toISOString() : null,
      };

      if (shopId) {
        const data = await api<{ shop: { images: ImageItem[] } }>(`/api/admin/shops/${shopId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        setImages(data.shop.images);
        report("details", "Saved.");
        router.refresh();
      } else {
        const data = await api<{ shop: { id: string } }>("/api/admin/shops", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        setShopId(data.shop.id);
        report("details", "Created — you can now add hours, prices and photos.");
        router.replace(`/admin/shops/${data.shop.id}`);
        router.refresh();
      }
    } catch (cause) {
      report("details", null, cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function saveHours() {
    if (!shopId) return report("hours", null, "Save the shop details first.");
    setBusy("hours");
    report("hours", null);
    try {
      await api(`/api/admin/shops/${shopId}/hours`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(week),
      });
      report("hours", "Hours saved.");
      router.refresh();
    } catch (cause) {
      report("hours", null, cause instanceof Error ? cause.message : "Could not save hours.");
    } finally {
      setBusy(null);
    }
  }

  async function saveServices() {
    if (!shopId) return report("services", null, "Save the shop details first.");
    setBusy("services");
    report("services", null);
    try {
      const payload = services
        .filter((service) => service.name.trim())
        .map((service) => ({
          name: service.name.trim(),
          priceNaira: Number(service.priceNaira || "0"),
          durationMinutes: service.durationMinutes.trim() ? Number(service.durationMinutes) : null,
        }));

      if (payload.some((service) => !Number.isFinite(service.priceNaira) || service.priceNaira < 0)) {
        throw new Error("Prices must be numbers in naira.");
      }

      await api(`/api/admin/shops/${shopId}/services`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      report("services", "Price list saved.");
      router.refresh();
    } catch (cause) {
      report("services", null, cause instanceof Error ? cause.message : "Could not save prices.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadImage(file: File) {
    if (!shopId) return report("images", null, "Save the shop details first.");
    setBusy("images");
    report("images", null);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api<{ image: ImageItem }>(`/api/admin/shops/${shopId}/images`, {
        method: "POST",
        body: form,
      });
      setImages((current) => [...current, data.image]);
      report("images", "Photo uploaded.");
      router.refresh();
    } catch (cause) {
      report("images", null, cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteImage(imageId: string) {
    if (!shopId) return;
    setBusy("images");
    report("images", null);
    try {
      await api(`/api/admin/shops/${shopId}/images/${imageId}`, { method: "DELETE" });
      setImages((current) => current.filter((image) => image.id !== imageId));
      report("images", "Photo removed.");
      router.refresh();
    } catch (cause) {
      report("images", null, cause instanceof Error ? cause.message : "Could not delete the photo.");
    } finally {
      setBusy(null);
    }
  }

  async function markVerified() {
    if (!shopId) return;
    setBusy("verify");
    report("verify", null);
    try {
      await api(`/api/admin/shops/${shopId}/verify`, { method: "POST" });
      report("verify", "Marked as checked today.");
      router.refresh();
    } catch (cause) {
      report("verify", null, cause instanceof Error ? cause.message : "Could not update.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteShop() {
    if (!shopId) return;
    if (!window.confirm("Remove this shop from Gentry? This cannot be undone.")) return;
    setBusy("delete");
    report("delete", null);
    try {
      await api(`/api/admin/shops/${shopId}`, { method: "DELETE" });
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      report("delete", null, cause instanceof Error ? cause.message : "Could not delete.");
      setBusy(null);
    }
  }

  const needsFirstSave = !shopId;

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="details-heading" className="card p-4">
        <h2 id="details-heading" className="font-display text-lg font-semibold">
          Shop details
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Name *
            <input
              className="field"
              value={details.name}
              onChange={(event) => patchDetails("name", event.target.value)}
              required
              minLength={2}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Street address
            <input
              className="field"
              value={details.address}
              onChange={(event) => patchDetails("address", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Landmark directions
            <input
              className="field"
              placeholder="Turn at the bakery, first street on the left"
              value={details.landmarkNote}
              onChange={(event) => patchDetails("landmarkNote", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Latitude *
            <input
              className="field"
              inputMode="decimal"
              value={details.lat}
              onChange={(event) => patchDetails("lat", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Longitude *
            <input
              className="field"
              inputMode="decimal"
              value={details.lng}
              onChange={(event) => patchDetails("lng", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Phone
            <input
              className="field"
              placeholder="+234 805 000 0000"
              value={details.phone}
              onChange={(event) => patchDetails("phone", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            WhatsApp (digits only)
            <input
              className="field"
              placeholder="2348050000000"
              inputMode="numeric"
              value={details.whatsapp}
              onChange={(event) => patchDetails("whatsapp", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Description
            <textarea
              className="field min-h-24"
              value={details.description}
              onChange={(event) => patchDetails("description", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Amenities (comma separated)
            <input
              className="field"
              placeholder="Air conditioning, TV / football, Appointment only"
              value={details.amenities}
              onChange={(event) => patchDetails("amenities", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Hours source
            <select
              className="field"
              value={details.hoursSource}
              onChange={(event) => patchDetails("hoursSource", event.target.value as Details["hoursSource"])}
            >
              <option value="manual">Published by the shop</option>
              <option value="unknown">Not listed — call to confirm</option>
              <option value="osm">From OpenStreetMap</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Temporary override
            <select
              className="field"
              value={details.overrideStatus}
              onChange={(event) => patchDetails("overrideStatus", event.target.value)}
            >
              <option value="">Normal hours</option>
              <option value="open">Force “open now”</option>
              <option value="closed">Force “closed now”</option>
            </select>
          </label>
          {details.overrideStatus && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Override until
              <input
                type="datetime-local"
                className="field"
                value={details.overrideUntil}
                onChange={(event) => patchDetails("overrideUntil", event.target.value)}
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <input
              type="checkbox"
              checked={details.isPublished}
              onChange={(event) => patchDetails("isPublished", event.target.checked)}
              className="h-5 w-5"
            />
            Published (visible to visitors)
          </label>
        </div>
        <div className="mt-3">
          <SaveBar
            busy={busy === "details"}
            message={messages.details ?? null}
            error={errors.details ?? null}
            onSave={saveDetails}
            label={needsFirstSave ? "Create shop" : "Save details"}
          />
        </div>
      </section>

      <section aria-labelledby="hours-heading" className="card p-4">
        <h2 id="hours-heading" className="font-display text-lg font-semibold">
          Opening hours
        </h2>
        <p className="text-sm text-muted">
          {needsFirstSave ? "Save the shop details first, then publish hours." : "Leave a day empty if the shop is closed."}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {week.map((ranges, dayIndex) => (
            <div key={dayIndex} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{DAY_LABELS[dayIndex]}</span>
                <button
                  type="button"
                  className="btn btn-ghost min-h-9 px-3 text-xs"
                  disabled={needsFirstSave}
                  onClick={() => {
                    setWeek((current) =>
                      current.map((day, index) =>
                        index === dayIndex ? [...day, { open: "09:00", close: "18:00" }] : day,
                      ),
                    );
                  }}
                >
                  + Add hours
                </button>
              </div>
              {ranges.length === 0 ? (
                <p className="text-sm text-muted">Closed</p>
              ) : (
                ranges.map((range, rangeIndex) => (
                  <div key={rangeIndex} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      className="field w-32"
                      value={range.open}
                      onChange={(event) =>
                        setWeek((current) =>
                          current.map((day, index) =>
                            index === dayIndex
                              ? day.map((item, i) => (i === rangeIndex ? { ...item, open: event.target.value } : item))
                              : day,
                          ),
                        )
                      }
                    />
                    <span className="text-sm text-muted">to</span>
                    <input
                      type="time"
                      className="field w-32"
                      value={range.close}
                      onChange={(event) =>
                        setWeek((current) =>
                          current.map((day, index) =>
                            index === dayIndex
                              ? day.map((item, i) => (i === rangeIndex ? { ...item, close: event.target.value } : item))
                              : day,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-ghost min-h-9 px-3 text-xs"
                      onClick={() =>
                        setWeek((current) =>
                          current.map((day, index) =>
                            index === dayIndex ? day.filter((_, i) => i !== rangeIndex) : day,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <SaveBar
            busy={busy === "hours"}
            message={messages.hours ?? null}
            error={errors.hours ?? null}
            onSave={saveHours}
          />
        </div>
      </section>

      <section aria-labelledby="prices-heading" className="card p-4">
        <h2 id="prices-heading" className="font-display text-lg font-semibold">
          Services & prices
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {services.map((service, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium">
                Service
                <input
                  className="field"
                  value={service.name}
                  onChange={(event) =>
                    setServices((current) =>
                      current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                    )
                  }
                />
              </label>
              <label className="flex w-28 flex-col gap-1 text-xs font-medium">
                Price (₦)
                <input
                  className="field"
                  inputMode="numeric"
                  value={service.priceNaira}
                  onChange={(event) =>
                    setServices((current) =>
                      current.map((item, i) => (i === index ? { ...item, priceNaira: event.target.value } : item)),
                    )
                  }
                />
              </label>
              <label className="flex w-28 flex-col gap-1 text-xs font-medium">
                Minutes
                <input
                  className="field"
                  inputMode="numeric"
                  value={service.durationMinutes}
                  onChange={(event) =>
                    setServices((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, durationMinutes: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost min-h-11 px-3 text-xs"
                onClick={() => setServices((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setServices((current) => [...current, { name: "", priceNaira: "", durationMinutes: "" }])
            }
          >
            + Add service
          </button>
        </div>
        <div className="mt-3">
          <SaveBar
            busy={busy === "services"}
            message={messages.services ?? null}
            error={errors.services ?? null}
            onSave={saveServices}
          />
        </div>
      </section>

      <section aria-labelledby="photos-heading" className="card p-4">
        <h2 id="photos-heading" className="font-display text-lg font-semibold">
          Photos
        </h2>
        <p className="text-sm text-muted">
          {images.length}/{MAX_SHOP_IMAGES} used. JPEG, PNG, WebP or GIF, up to 5 MB each.
        </p>
        <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-surface-2">
          {busy === "images" ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="sr-only"
            disabled={busy === "images" || needsFirstSave}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadImage(file);
              event.target.value = "";
            }}
          />
        </label>
        {images.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((image) => (
              <li key={image.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt="Shop photo"
                  className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  className="btn btn-ghost min-h-9 text-xs"
                  onClick={() => void deleteImage(image.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          {messages.images && <p className="text-sm text-open">{messages.images}</p>}
          {errors.images && (
            <p role="alert" className="text-sm text-closed">
              {errors.images}
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="maintenance-heading" className="card flex flex-col gap-3 p-4">
        <h2 id="maintenance-heading" className="font-display text-lg font-semibold">
          Maintenance
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={markVerified} disabled={!shopId || busy === "verify"}>
            {busy === "verify" ? "Saving…" : "Mark as checked today"}
          </button>
          {shopId && (
            <button type="button" className="btn btn-ghost" onClick={deleteShop} disabled={busy === "delete"}>
              Remove shop
            </button>
          )}
        </div>
        {messages.verify && <p className="text-sm text-open">{messages.verify}</p>}
        {errors.verify && (
          <p role="alert" className="text-sm text-closed">
            {errors.verify}
          </p>
        )}
        {errors.delete && (
          <p role="alert" className="text-sm text-closed">
            {errors.delete}
          </p>
        )}
        {shopId && (
          <p className={cn("text-xs text-muted")}>
            Last verified:{" "}
            {shop?.lastVerifiedAt ? new Date(shop.lastVerifiedAt).toLocaleString("en-GB") : "never"}
          </p>
        )}
      </section>
    </div>
  );
}
