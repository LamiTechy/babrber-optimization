"use client";

import { useState } from "react";
import { SERVICE_AREA_CENTER } from "@/lib/config";
import type { LandmarkDto } from "@/lib/data/landmarks";
import { saveLocation, type SavedLocation } from "@/lib/location/store";
import { cn } from "@/lib/utils";
import { MapView } from "./map-view";

type Busy = null | "resolve" | "gps";

type Props = {
  landmarks: LandmarkDto[];
  onResolved: (location: SavedLocation) => void;
  label?: string;
  /** Larger hero treatment on the home page. */
  prominent?: boolean;
};

function geolocationMessage(code: number): string {
  if (code === 1) {
    return "Location permission was blocked. Type a landmark or paste a Google Maps link instead.";
  }
  return "We couldn't read your location just now. Try again, or type a landmark.";
}

export function LocationPicker({ landmarks, onResolved, label, prominent = false }: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  async function resolveText(input: string, displayLabel?: string) {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Tell us where you are — a landmark, an address or a maps link.");
      return;
    }
    setBusy("resolve");
    setError(null);
    try {
      const response = await fetch("/api/location/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      const payload = (await response.json()) as
        | { ok: true; data: { lat: number; lng: number; source: SavedLocation["source"] } }
        | { ok: false; error?: { message?: string } };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Location failed" : (payload.error?.message ?? "Location failed"));
      }

      onResolved(
        saveLocation({
          lat: payload.data.lat,
          lng: payload.data.lng,
          label: displayLabel ?? trimmed,
          source: payload.data.source,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't find that place.");
    } finally {
      setBusy(null);
    }
  }

  function useGps() {
    if (!("geolocation" in navigator)) {
      setError("This browser can't share a location. Type a landmark instead.");
      return;
    }
    setBusy("gps");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(null);
        onResolved(
          saveLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            label: "My current location",
            source: "gps",
          }),
        );
      },
      (cause) => {
        setBusy(null);
        setError(geolocationMessage(cause.code));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function usePin() {
    if (!pin) return;
    onResolved(
      saveLocation({
        lat: Number(pin.lat.toFixed(6)),
        lng: Number(pin.lng.toFixed(6)),
        label: `Pinned at ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`,
        source: "pin",
      }),
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", prominent && "card p-4 sm:p-5")}>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void resolveText(value);
        }}
      >
        <div className="flex-1">
          <label htmlFor="location-input" className="sr-only">
            Your location
          </label>
          <input
            id="location-input"
            name="location"
            className="field"
            placeholder="Landmark, street or Google Maps link"
            value={value}
            autoComplete="street-address"
            enterKeyHint="search"
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary h-12 w-full sm:w-auto"
          disabled={busy !== null}
        >
          {busy === "resolve" ? "Finding…" : "Search"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={useGps}
          disabled={busy !== null}
          className="btn btn-secondary"
          aria-busy={busy === "gps"}
        >
          <CrosshairIcon />
          {busy === "gps" ? "Locating…" : "Use my location"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowPin((current) => !current);
            setPin(null);
            setError(null);
          }}
          className="btn btn-ghost"
          aria-expanded={showPin}
        >
          <PinIcon />
          {showPin ? "Hide pin drop" : "Drop a pin"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-closed-soft px-3 py-2 text-sm text-closed">
          {error}
        </p>
      )}

      {showPin && (
        <div className="flex flex-col gap-2">
          <MapView
            className="h-64 sm:h-72"
            center={pin ?? SERVICE_AREA_CENTER}
            zoom={14}
            onPick={(point) => setPin(point)}
            points={
              pin
                ? [{ id: "pin", lat: pin.lat, lng: pin.lng, label: "Chosen spot" }]
                : []
            }
          />
          <div className="flex items-center justify-between gap-3 text-sm text-muted">
            <p>{pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Tap the map to drop your pin."}</p>
            <button type="button" onClick={usePin} disabled={!pin} className="btn btn-primary">
              Use this pin
            </button>
          </div>
        </div>
      )}

      {landmarks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Or pick a landmark
          </p>
          <ul className="flex flex-wrap gap-2">
            {landmarks.map((landmark) => (
              <li key={landmark.id}>
                <button
                  type="button"
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:border-gold hover:text-gold"
                  onClick={() => void resolveText(landmark.name, landmark.name)}
                  disabled={busy !== null}
                >
                  {landmark.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {label && <p className="text-sm text-muted">Searching around: {label}</p>}
    </div>
  );
}

function CrosshairIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2a1 1 0 0 1 1 1v2.06A8 8 0 0 1 18.94 11H21a1 1 0 1 1 0 2h-2.06A8 8 0 0 1 13 18.94V21a1 1 0 1 1-2 0v-2.06A8 8 0 0 1 5.06 13H3a1 1 0 1 1 0-2h2.06A8 8 0 0 1 11 5.06V3a1 1 0 0 1 1-1Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  );
}
