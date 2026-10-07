import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_AREA, SERVICE_AREA_RADIUS_KM } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy note",
  description: "Gentry stores nothing about you. Location stays on your device.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Privacy note</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
        <p>
          <strong className="text-foreground">Your location never leaves your device as a
          profile.</strong>{" "}
          When you search, we send one pair of coordinates with that single request so we can sort
          shops by walking distance. We do not store it, log it, or attach it to you.
        </p>
        <p>
          The last place you searched is remembered in your browser&apos;s local storage so you do
          not have to type it again. Clearing your browser data removes it.
        </p>
        <p>
          We do not use advertising trackers or third-party analytics. There are no accounts and no
          cookies beyond that saved location and your light/dark theme choice.
        </p>
        <p>
          Phone and WhatsApp buttons open your own dialler or messaging app — the message you send
          goes to the shop, not to us.
        </p>
        <p>
          Shop listings cover a {SERVICE_AREA_RADIUS_KM} km radius around {SERVICE_AREA.name},{" "}
          {SERVICE_AREA.city}, {SERVICE_AREA.state}, and include publicly available map data ©
          OpenStreetMap contributors.
        </p>
        <p>
          Questions? Use the contact address in the site footer.
        </p>
      </div>
      <div className="mt-6">
        <Link href="/" className="btn btn-secondary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
