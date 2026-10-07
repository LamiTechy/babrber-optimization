import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapView } from "@/components/map-view";
import { ShopGallery } from "@/components/shop-gallery";
import { StatusBadge } from "@/components/status-badge";
import { SERVICE_AREA } from "@/lib/config";
import { getShopBySlug } from "@/lib/data/shops";
import { formatClock } from "@/lib/format";
import { directionsUrl, telHref, whatsappHref } from "@/lib/links";
import { cn, formatNaira } from "@/lib/utils";

type Params = { slug: string };

// Open/closed status must be computed when the page is requested, never baked.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) return { title: "Shop not found" };

  const summary = shop.services.slice(0, 3).map((service) => service.name).join(", ");
  const description = [
    shop.name,
    summary ? `Services: ${summary}.` : null,
    shop.address ? `Located at ${shop.address}.` : null,
    "Live opening hours and phone numbers on Gentry.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: shop.name,
    description,
    openGraph: {
      title: shop.name,
      description,
      type: "website",
    },
  };
}

function ActionBar({
  phone,
  whatsapp,
  whatsappLabel,
  location,
  name,
}: {
  phone: string | null;
  whatsapp: string | null;
  whatsappLabel: string;
  location: { lat: number; lng: number; name: string };
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {phone ? (
        <a href={telHref(phone)} className="btn btn-primary flex-1" aria-label={`Call ${name}`}>
          Call {phone}
        </a>
      ) : (
        <p className="text-sm text-muted">No phone listed — visit in person.</p>
      )}
      {whatsapp && (
        <a
          href={whatsappHref(whatsapp, whatsappLabel)}
          className="btn btn-secondary flex-1"
          aria-label={`Message ${name} on WhatsApp`}
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
      )}
      <a
        href={directionsUrl(location)}
        className="btn btn-ghost flex-1"
        aria-label={`Walking directions to ${name}`}
        rel="noopener noreferrer"
      >
        Directions
      </a>
    </div>
  );
}

function SourceNote({
  source,
  lastVerifiedAt,
  hoursSource,
}: {
  source: "osm" | "manual" | "sample";
  lastVerifiedAt: string | null;
  hoursSource: "osm" | "manual" | "unknown";
}) {
  const copy =
    source === "osm"
      ? "Listing imported from OpenStreetMap."
      : source === "sample"
        ? "Sample listing used for demos."
        : "Added by the Gentry team.";

  const hours =
    hoursSource === "osm"
      ? "Opening hours come from the shop's own OSM tag and may be out of date."
      : hoursSource === "manual"
        ? "Opening hours are published by the shop."
        : "No hours on file — call before you travel.";

  return (
    <p className="text-xs text-muted">
      {copy} {hours}
      {lastVerifiedAt ? ` Last checked ${new Date(lastVerifiedAt).toLocaleDateString("en-GB")}.` : ""}
    </p>
  );
}

export default async function ShopPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const hasAnyHours = shop.hours.some((day) => day.ranges.length > 0);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-6">
      <nav className="mb-4 text-sm text-muted">
        <Link href="/results" className="underline underline-offset-2 hover:text-foreground">
          ← Back to results
        </Link>
      </nav>

      <header className="card flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {shop.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {shop.address ?? SERVICE_AREA.name}
              {shop.walkingLabel ? ` · ${shop.walkingLabel}` : ""}
            </p>
          </div>
          <StatusBadge status={shop.status} className="shrink-0" />
        </div>

        {shop.landmarkNote && <p className="text-sm text-muted">{shop.landmarkNote}</p>}

        <ActionBar
          phone={shop.phone}
          whatsapp={shop.whatsapp ?? shop.phone}
          whatsappLabel={`Hi ${shop.name}, I found you on Gentry. Are you open right now?`}
          location={{ lat: shop.lat, lng: shop.lng, name: shop.name }}
          name={shop.name}
        />

        <SourceNote
          source={shop.source}
          lastVerifiedAt={shop.lastVerifiedAt}
          hoursSource={shop.hoursSource}
        />
      </header>

      <section aria-labelledby="services-heading" className="card mt-4 p-4 sm:p-5">
        <h2 id="services-heading" className="font-display text-lg font-semibold">
          Services & prices
        </h2>
        {shop.services.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No price list published yet — call {shop.name} to confirm.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {shop.services.map((service) => (
              <li key={service.name} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="text-sm font-medium">{service.name}</span>
                <span className="text-sm font-semibold text-gold tabular-nums">
                  {formatNaira(service.priceNaira)}
                  {service.durationMinutes ? (
                    <span className="ml-2 font-normal text-muted">
                      {service.durationMinutes} min
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {shop.priceFrom !== null && (
          <p className="mt-3 text-xs text-muted">From {formatNaira(shop.priceFrom)}.</p>
        )}
      </section>

      <section aria-labelledby="hours-heading" className="card mt-4 p-4 sm:p-5">
        <h2 id="hours-heading" className="font-display text-lg font-semibold">
          Opening hours
        </h2>
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Weekly opening hours in Africa/Lagos time</caption>
          <tbody>
            {shop.hours.map((day) => (
              <tr
                key={day.dayOfWeek}
                className={cn("border-b border-border last:border-0", day.isToday && "bg-surface-2")}
              >
                <th
                  scope="row"
                  className={cn("py-2.5 text-left font-medium", day.isToday && "text-foreground")}
                >
                  {day.label}
                  {day.isToday && <span className="ml-1.5 text-xs font-semibold text-gold">today</span>}
                </th>
                <td className="py-2.5 text-right text-muted">
                  {day.ranges.length === 0
                    ? "Closed"
                    : day.ranges
                        .map((range) => `${formatClock(range.open)} – ${formatClock(range.close)}`)
                        .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!hasAnyHours && (
          <p className="mt-2 text-xs text-muted">Hours are not listed — call before you travel.</p>
        )}
        <p className="mt-3 text-xs text-muted">Times shown in Africa/Lagos time.</p>
      </section>

      {shop.amenities.length > 0 && (
        <section aria-labelledby="amenities-heading" className="card mt-4 p-4 sm:p-5">
          <h2 id="amenities-heading" className="font-display text-lg font-semibold">
            Good to know
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {shop.amenities.map((amenity) => (
              <li
                key={amenity}
                className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted"
              >
                {amenity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {shop.description && (
        <section aria-labelledby="about-heading" className="card mt-4 p-4 sm:p-5">
          <h2 id="about-heading" className="font-display text-lg font-semibold">
            About {shop.name}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{shop.description}</p>
        </section>
      )}

      <section aria-labelledby="photos-heading" className="mt-4">
        <h2 id="photos-heading" className="mb-3 font-display text-lg font-semibold">
          Photos
        </h2>
        <ShopGallery images={shop.images} name={shop.name} />
      </section>

      <section aria-labelledby="map-heading" className="mt-4">
        <h2 id="map-heading" className="mb-3 font-display text-lg font-semibold">
          Where it is
        </h2>
        <MapView
          className="h-64 sm:h-80"
          center={{ lat: shop.lat, lng: shop.lng }}
          zoom={16}
          points={[
            {
              id: shop.id,
              lat: shop.lat,
              lng: shop.lng,
              label: shop.name,
              href: `/shop/${shop.slug}`,
              state: shop.status.state,
              isSelected: true,
            },
          ]}
        />
      </section>
    </article>
  );
}
