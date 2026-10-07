"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { LandmarkDto } from "@/lib/data/landmarks";
import { locationQuery, readLocation, type SavedLocation } from "@/lib/location/store";
import { LocationPicker } from "./location-picker";

/**
 * Results need a location. If this device already told us once, we send them
 * straight there; otherwise the picker is already on screen waiting for them.
 */
export function LocationPrompt({ landmarks }: { landmarks: LandmarkDto[] }) {
  const router = useRouter();

  useEffect(() => {
    const saved = readLocation();
    if (saved) router.replace(`/results?${locationQuery(saved)}`);
  }, [router]);

  function handleResolved(location: SavedLocation) {
    router.replace(`/results?${locationQuery(location)}`);
  }

  return (
    <section className="card p-4">
      <h1 className="font-display text-xl font-semibold">Where are you?</h1>
      <p className="mb-3 text-sm text-muted">
        We need a starting point to sort barbers by walking distance.
      </p>
      <LocationPicker landmarks={landmarks} onResolved={handleResolved} />
    </section>
  );
}
