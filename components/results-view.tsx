"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DISTANCE_FILTERS, SERVICE_AREA_RADIUS_KM, SERVICE_FILTERS } from "@/lib/config";
import type { LandmarkDto } from "@/lib/data/landmarks";
import { type SavedLocation } from "@/lib/location/store";
import type { NearbyResult } from "@/lib/data/shops";
import { resultsQueryString, type ResultsFilters, type ResultsLocation } from "@/lib/results-query";
import { cn } from "@/lib/utils";
import { LocationPicker } from "./location-picker";
import { MapView } from "./map-view";
import { ShopCard } from "./shop-card";

type Props = {
  location: ResultsLocation;
  filters: ResultsFilters;
  result: NearbyResult;
  landmarks: LandmarkDto[];
};

type View = "list" | "map";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition-colors sm:text-sm",
        active
          ? "border-transparent bg-charcoal-900 text-[#faf7f2] dark:bg-gold-500 dark:text-charcoal-900"
          : "border-border bg-surface text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function ResultsView({ location, filters, result, landmarks }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [showChange, setShowChange] = useState(false);
  const [pending, startTransition] = useTransition();

  function applyFilters(patch: Partial<ResultsFilters>) {
    const next: ResultsFilters = { ...filters, ...patch };
    startTransition(() => {
      router.replace(`/results?${resultsQueryString(location, next)}`, { scroll: false });
    });
  }

  function applyLocation(next: SavedLocation) {
    setShowChange(false);
    startTransition(() => {
      router.replace(`/results?${resultsQueryString(next, filters)}`, { scroll: false });
    });
  }

  const points = result.shops.map((shop) => ({
    id: shop.id,
    lat: shop.lat,
    lng: shop.lng,
    label: shop.name,
    href: `/shop/${shop.slug}`,
    state: shop.status.state,
  }));

  const count = result.shops.length;
  const hasFilters = filters.openNow || filters.service !== null || filters.maxKm !== null;

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="location-heading" className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Searching near</p>
            <h1 id="location-heading" className="truncate font-display text-xl font-semibold">
              {location.label}
            </h1>
          </div>
          <button
            type="button"
            className="btn btn-ghost shrink-0"
            onClick={() => setShowChange((current) => !current)}
            aria-expanded={showChange}
          >
            Change
          </button>
        </div>
        {showChange && (
          <div className="mt-3 border-t border-border pt-3">
            <LocationPicker landmarks={landmarks} onResolved={applyLocation} />
          </div>
        )}
      </section>

      <section aria-label="Filters" className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={filters.sort === "open"} onClick={() => applyFilters({ sort: "open" })}>
            Open now first
          </Chip>
          <Chip active={filters.sort === "nearby"} onClick={() => applyFilters({ sort: "nearby" })}>
            Nearest first
          </Chip>
          <Chip active={filters.openNow} onClick={() => applyFilters({ openNow: !filters.openNow })}>
            Only open
          </Chip>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={filters.service === null} onClick={() => applyFilters({ service: null })}>
            All services
          </Chip>
          {SERVICE_FILTERS.map((service) => (
            <Chip
              key={service}
              active={filters.service === service}
              onClick={() =>
                applyFilters({ service: filters.service === service ? null : service })
              }
            >
              {service}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={filters.maxKm === null} onClick={() => applyFilters({ maxKm: null })}>
            Any distance
          </Chip>
          {DISTANCE_FILTERS.map((km) => (
            <Chip
              key={km}
              active={filters.maxKm === km}
              onClick={() => applyFilters({ maxKm: filters.maxKm === km ? null : km })}
            >
              Within {km} km
            </Chip>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {count === 0
            ? "No shops match those filters"
            : `${count} ${count === 1 ? "barber shop" : "barber shops"} nearby`}
        </p>
        <div className="flex rounded-xl border border-border bg-surface p-1" role="group">
          {(["list", "map"] as View[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={cn(
                "min-h-9 rounded-lg px-3 text-xs font-semibold capitalize",
                view === option ? "bg-charcoal-900 text-[#faf7f2] dark:bg-gold-500 dark:text-charcoal-900" : "text-muted",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {result.outsideArea && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold">
          That is outside our {SERVICE_AREA_RADIUS_KM} km service area, so these are the closest
          shops we cover.
        </p>
      )}

      <div className={cn("flex flex-col gap-3", pending && "opacity-60")} aria-busy={pending}>
        {view === "map" ? (
          <MapView
            className="h-[60vh] min-h-80"
            points={[
              { id: "you", lat: location.lat, lng: location.lng, label: "You are here", isYou: true },
              ...points,
            ]}
            center={{ lat: location.lat, lng: location.lng }}
            zoom={15}
            fit
            youLabel={location.label}
          />
        ) : result.shops.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onReset={() => applyFilters({ service: null, maxKm: null, openNow: false })} landmarks={landmarks} />
        ) : (
          result.shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)
        )}
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onReset,
  landmarks,
}: {
  hasFilters: boolean;
  onReset: () => void;
  landmarks: LandmarkDto[];
}) {
  return (
    <div className="card flex flex-col gap-3 p-5 text-center">
      <h2 className="font-display text-lg font-semibold">No barbers found here yet</h2>
      <p className="text-sm text-muted">
        {hasFilters
          ? "Try clearing the filters — we may have shops that match without them."
          : "This area is still being mapped. Try another landmark, or drop a pin somewhere busier."}
      </p>
      {hasFilters && (
        <button type="button" className="btn btn-secondary self-center" onClick={onReset}>
          Clear filters
        </button>
      )}
      {landmarks.length > 0 && (
        <p className="text-xs text-muted">Popular spots: {landmarks.map((l) => l.name).join(" · ")}</p>
      )}
    </div>
  );
}
