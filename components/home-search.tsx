"use client";

import { useRouter } from "next/navigation";
import type { LandmarkDto } from "@/lib/data/landmarks";
import { locationQuery, type SavedLocation } from "@/lib/location/store";
import { LocationPicker } from "./location-picker";

export function HomeSearch({ landmarks }: { landmarks: LandmarkDto[] }) {
  const router = useRouter();

  function handleResolved(location: SavedLocation) {
    router.push(`/results?${locationQuery(location)}`);
  }

  return <LocationPicker landmarks={landmarks} prominent onResolved={handleResolved} />;
}
