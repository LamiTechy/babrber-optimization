import Link from "next/link";
import { directionsUrl, telHref, whatsappHref } from "@/lib/links";
import type { ShopCardDto } from "@/lib/types";
import { cn, formatNaira } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

function ServiceChips({ services }: { services: ShopCardDto["services"] }) {
  if (!services.length) return null;
  const shown = services.slice(0, 3);
  const rest = services.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {shown.map((service) => (
        <li
          key={service.name}
          className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted"
        >
          {service.name} · {formatNaira(service.priceNaira)}
        </li>
      ))}
      {rest > 0 && (
        <li className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted">
          +{rest} more
        </li>
      )}
    </ul>
  );
}

function QuickAction({
  href,
  label,
  children,
  primary = false,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors",
        primary ? "btn-primary" : "btn-ghost",
      )}
    >
      {children}
    </a>
  );
}

export function ShopCard({ shop, className }: { shop: ShopCardDto; className?: string }) {
  const hasPhone = Boolean(shop.phone);

  return (
    <article className={cn("card flex flex-col gap-3 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold leading-snug">
            <Link href={`/shop/${shop.slug}`} className="hover:text-gold focus-visible:underline">
              {shop.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            {shop.distanceLabel}
            {shop.walkingLabel ? ` · ${shop.walkingLabel}` : ""}
          </p>
        </div>
        <StatusBadge status={shop.status} className="shrink-0" />
      </div>

      {shop.landmarkNote ? (
        <p className="text-sm text-muted">{shop.landmarkNote}</p>
      ) : shop.address ? (
        <p className="text-sm text-muted">{shop.address}</p>
      ) : null}

      <ServiceChips services={shop.services} />

      <div className="mt-auto flex gap-2 pt-1">
        {hasPhone ? (
          <>
            <QuickAction href={telHref(shop.phone!)} label={`Call ${shop.name}`} primary>
              <PhoneIcon />
              Call
            </QuickAction>
            <QuickAction
              href={whatsappHref(shop.whatsapp ?? shop.phone!, `Hi ${shop.name}, I found you on Gentry.`)}
              label={`Message ${shop.name} on WhatsApp`}
            >
              <ChatIcon />
              WhatsApp
            </QuickAction>
          </>
        ) : (
          <p className="text-sm text-muted">No phone listed yet — visit in person.</p>
        )}
        <QuickAction
          href={directionsUrl({ lat: shop.lat, lng: shop.lng, name: shop.name })}
          label={`Directions to ${shop.name}`}
        >
          <PinIcon />
          Directions
        </QuickAction>
      </div>
    </article>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1l-2.22 2.2Z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Zm0 2a7 7 0 1 1-3.6 13l-.5-.3-2.3.6.6-2.2-.3-.5A7 7 0 0 1 12 5Zm-2.4 3.2c-.2 0-.5.1-.7.4-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.5 2.4 3.7 3.2 1.8.7 2.2.6 2.6.5.4 0 1.3-.5 1.5-1.1.2-.6.2-1 .1-1.1l-.6-.3-1.4-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.1-.3.2-.5.1a5.7 5.7 0 0 1-1.7-1 6.3 6.3 0 0 1-1.2-1.5c-.1-.2 0-.4.1-.5l.4-.5.3-.5v-.4l-.7-1.6c-.2-.4-.4-.4-.6-.4Z" />
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
