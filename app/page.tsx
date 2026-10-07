import type { Metadata } from "next";
import Link from "next/link";
import { HomeSearch } from "@/components/home-search";
import {
  SERVICE_AREA,
  SERVICE_AREA_RADIUS_KM,
  SERVICE_FILTERS,
  SITE_DESCRIPTION,
  SITE_TAGLINE,
} from "@/lib/config";
import { getLandmarks } from "@/lib/data/landmarks";

export const metadata: Metadata = {
  title: `Barbers near you in ${SERVICE_AREA.name}, ${SERVICE_AREA.city}`,
  description: SITE_DESCRIPTION,
};

// Landmarks are read per request so a newly added one shows up immediately.
export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Tell us where you are",
    body: "Use GPS, paste a Google Maps link, or tap a landmark you already know.",
  },
  {
    title: "See who is open",
    body: "Every shop shows a live open/closed label, walking time and the price list.",
  },
  {
    title: "Call or WhatsApp",
    body: "One tap to reach the barber, or one tap for walking directions.",
  },
];

export default async function HomePage() {
  const landmarks = await getLandmarks();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <section className="pt-10 pb-8 text-center sm:pt-14">
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
          {SERVICE_AREA.name} · {SERVICE_AREA.city}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] font-semibold tracking-tight text-foreground sm:text-5xl">
          Sharp cuts, close by.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">
          {SITE_TAGLINE} Find the nearest barber shops around {SERVICE_AREA.name} — who is open
          right now, what it costs, and how long it takes to walk there.
        </p>
      </section>

      <section aria-labelledby="find-heading" className="card p-4 sm:p-5">
        <h2 id="find-heading" className="font-display text-lg font-semibold">
          Where are you?
        </h2>
        <p className="mb-3 text-sm text-muted">
          We only show shops within {SERVICE_AREA_RADIUS_KM} km of {SERVICE_AREA.name}.
        </p>
        <HomeSearch landmarks={landmarks} />
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
          Your location stays on this device — we never store your exact coordinates.{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy note
          </Link>
        </p>
      </section>

      <section aria-labelledby="services-heading" className="mt-10">
        <h2 id="services-heading" className="font-display text-xl font-semibold">
          What are you looking for?
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SERVICE_FILTERS.map((service) => (
            <li key={service}>
              <Link
                href={`/results?service=${encodeURIComponent(service)}`}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium capitalize transition-colors hover:border-gold hover:text-gold"
              >
                {service}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-heading" className="mt-10">
        <h2 id="how-heading" className="font-display text-xl font-semibold">
          How it works
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card p-4">
              <span className="font-display text-2xl font-semibold text-gold">{index + 1}</span>
              <h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 rounded-2xl bg-surface-2 p-4 text-sm text-muted">
        <p>
          Opening hours come from OpenStreetMap and from the shops themselves, evaluated in
          Africa/Lagos time. Numbers marked “Hours not listed” should be called to confirm.
        </p>
      </section>
    </div>
  );
}
