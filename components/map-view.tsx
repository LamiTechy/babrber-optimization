"use client";

import dynamic from "next/dynamic";
import type { LeafletMapProps } from "./leaflet-map";

/**
 * Leaflet touches `window` during import, so the map only ever loads in the
 * browser. The shell renders immediately and keeps the page's height stable.
 */
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <MapShell className="" />,
});

export function MapShell({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-border bg-surface-2 ${className}`}
      aria-hidden
    />
  );
}

export function MapView({ className = "", ...props }: LeafletMapProps) {
  return <LeafletMap {...props} className={className} />;
}
