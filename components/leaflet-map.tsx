"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href?: string;
  state?: "open" | "soon" | "closed" | "unknown";
  isYou?: boolean;
  isSelected?: boolean;
};

export type LeafletMapProps = {
  points: MapPoint[];
  center: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  /** Expand the viewport so every point is visible. */
  fit?: boolean;
  /** Pin-drop mode: report every map click. */
  onPick?: (point: { lat: number; lng: number }) => void;
  /** Show the visitor's own position marker. */
  youLabel?: string;
};

function pinIcon(point: MapPoint): L.DivIcon {
  const classes = ["map-pin"];
  if (point.isYou) classes.push("map-pin-you");
  else {
    classes.push(`map-pin-${point.state ?? "unknown"}`);
    if (point.isSelected) classes.push("map-pin-selected");
  }
  return L.divIcon({
    className: "map-pin-wrap",
    html: `<span class="${classes.join(" ")}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

function FitBounds({ points, enabled }: { points: MapPoint[]; enabled: boolean }) {
  const map = useMap();
  const signature = useMemo(
    () => points.map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join("|"),
    [points],
  );

  useEffect(() => {
    if (!enabled || points.length === 0) return;
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, enabled, signature]);

  return null;
}

function ClickTarget({ onPick }: { onPick?: (point: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(event) {
      onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

export default function LeafletMap({
  points,
  center,
  zoom = 15,
  className = "",
  fit = false,
  onPick,
  youLabel,
}: LeafletMapProps) {
  const position: [number, number] = [center.lat, center.lng];

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border ${className}`}>
      <MapContainer
        center={position}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom={onPick ? false : true}
        attributionControl={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`}
          maxZoom={19}
        />
        <FitBounds points={points} enabled={fit} />
        <ClickTarget onPick={onPick} />
        {points.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lng]} icon={pinIcon(point)}>
            <Popup>
              <span className="text-sm font-semibold">{point.label}</span>
              {youLabel && point.isYou ? <div className="text-xs">{youLabel}</div> : null}
              {point.href ? (
                <div className="mt-1">
                  <Link href={point.href} className="text-sm font-semibold text-gold underline">
                    View shop
                  </Link>
                </div>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute right-2 bottom-2 z-[1000] rounded bg-background/85 px-1.5 py-0.5 text-[10px] text-muted">
        Map data © OpenStreetMap contributors
      </div>
    </div>
  );
}
