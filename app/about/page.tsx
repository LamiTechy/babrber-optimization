import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_AREA, SERVICE_AREA_RADIUS_KM } from "@/lib/config";

export const metadata: Metadata = {
  title: "About",
  description: `What Gentry covers, how we source opening hours, and why we only serve ${SERVICE_AREA.name}.`,
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">About Gentry</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
        <p>
          Gentry is a small, hyper-local directory of barber shops around {SERVICE_AREA.name},{" "}
          {SERVICE_AREA.city}, {SERVICE_AREA.state}. It exists for one reason: finding a barber
          should take seconds, not a scroll through unrelated results.
        </p>
        <p>
          We only cover a {SERVICE_AREA_RADIUS_KM} km radius around {SERVICE_AREA.name}. Everything
          you see is inside that circle, sorted by what matters — whether the shop is open right
          now, and how long it takes to walk there.
        </p>
        <h2 className="font-display text-xl font-semibold text-foreground">Where the information comes from</h2>
        <p>
          Shops, coordinates and some opening hours are imported from OpenStreetMap. Shops can also
          publish their own hours, prices and photos, which always take precedence. Hours are
          evaluated in Africa/Lagos time, so “open now” means open right now in Abeokuta.
        </p>
        <p>
          If something is wrong — a closed shop, an old number, a missing price — call the shop
          directly or tell us. Listings show when they were last checked.
        </p>
        <h2 className="font-display text-xl font-semibold text-foreground">Credits</h2>
        <p>
          Map data © OpenStreetMap contributors.{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Licence details
          </a>
          .
        </p>
      </div>
      <div className="mt-6">
        <Link href="/" className="btn btn-secondary">
          Find a barber near you
        </Link>
      </div>
    </div>
  );
}
