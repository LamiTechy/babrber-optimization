import type { Metadata } from "next";
import { LocationPrompt } from "@/components/location-prompt";
import { ResultsView } from "@/components/results-view";
import { getLandmarks } from "@/lib/data/landmarks";
import { getNearbyShops } from "@/lib/data/shops";
import { parseFilters, parseLocation } from "@/lib/results-query";

export const metadata: Metadata = {
  title: "Barbers near you",
  description: "Live barber shop listings around your location.",
  robots: { index: false, follow: true },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const location = parseLocation(params);
  const landmarks = await getLandmarks();

  if (!location) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <LocationPrompt landmarks={landmarks} />
      </div>
    );
  }

  const filters = parseFilters(params);
  const result = await getNearbyShops({
    lat: location.lat,
    lng: location.lng,
    openNow: filters.openNow,
    service: filters.service,
    maxKm: filters.maxKm,
    sort: filters.sort,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <ResultsView location={location} filters={filters} result={result} landmarks={landmarks} />
    </div>
  );
}
