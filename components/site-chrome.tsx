import Link from "next/link";
import { OSM_ATTRIBUTION, OSM_ATTRIBUTION_URL, SERVICE_AREA, SITE_NAME, SITE_TAGLINE } from "@/lib/config";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2" aria-label={`${SITE_NAME} home`}>
          <span
            aria-hidden
            className="h-6 w-1.5 rounded-full bg-gold transition-transform group-hover:scale-y-110"
          />
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">
            {SITE_NAME}
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/about"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-foreground xs:block"
          >
            About
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const contactEmail = process.env.CONTACT_EMAIL ?? "";
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-6 text-sm text-muted">
        <p className="font-display text-base font-semibold text-foreground">
          {SITE_NAME} <span className="font-body text-sm font-normal">— {SITE_TAGLINE}</span>
        </p>
        <p>
          Serving {SERVICE_AREA.name}, {SERVICE_AREA.city}, {SERVICE_AREA.state},{" "}
          {SERVICE_AREA.country} only.
        </p>
        <p>
          <a
            href={OSM_ATTRIBUTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {OSM_ATTRIBUTION}
          </a>
        </p>
        <p className="text-xs">
          Your location is used only to sort results on this device. We never store or log your
          exact coordinates. <Link href="/privacy" className="underline">Privacy note</Link>
        </p>
        <p className="text-xs">
          <Link href="/about" className="underline underline-offset-2 hover:text-foreground">
            About Gentry
          </Link>
          {contactEmail ? (
            <>
              {" · "}
              <a
                href={`mailto:${contactEmail}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {contactEmail}
              </a>
            </>
          ) : null}
        </p>
      </div>
    </footer>
  );
}
