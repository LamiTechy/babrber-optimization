import type { Metadata } from "next";
import Link from "next/link";
import { SyncButton } from "@/components/admin/sync-button";
import { SERVICE_AREA, SERVICE_AREA_RADIUS_KM } from "@/lib/config";
import { listAdminShops, type AdminShopListItem } from "@/lib/data/admin-shops";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

function Row({ shop }: { shop: AdminShopListItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <Link href={`/admin/shops/${shop.id}`} className="font-semibold hover:text-gold">
          {shop.name}
        </Link>
        <p className="text-xs text-muted">
          {shop.source === "osm" ? "OpenStreetMap" : shop.source === "sample" ? "Sample" : "Manual"}
          {" · "}
          {shop.serviceCount} {shop.serviceCount === 1 ? "service" : "services"}
          {" · "}
          {shop.imageCount} {shop.imageCount === 1 ? "photo" : "photos"}
          {shop.phone ? ` · ${shop.phone}` : " · no phone"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`badge ${shop.isDeleted ? "badge-closed" : shop.isPublished ? "badge-open" : "badge-soon"}`}>
          {shop.isDeleted ? "Deleted" : shop.isPublished ? "Live" : "Draft"}
        </span>
        <Link href={`/admin/shops/${shop.id}`} className="btn btn-ghost">
          Edit
        </Link>
      </div>
    </li>
  );
}

export default async function AdminDashboard() {
  const shops = await listAdminShops();
  const live = shops.filter((shop) => shop.isPublished && !shop.isDeleted);
  const missingPhone = shops.filter((shop) => !shop.phone && !shop.isDeleted);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-muted uppercase">Live shops</p>
          <p className="font-display text-2xl font-semibold">{live.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted uppercase">Missing a phone</p>
          <p className="font-display text-2xl font-semibold">{missingPhone.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted uppercase">Coverage</p>
          <p className="font-display text-2xl font-semibold">{SERVICE_AREA_RADIUS_KM} km</p>
          <p className="text-xs text-muted">{SERVICE_AREA.name}, {SERVICE_AREA.city}</p>
        </div>
      </section>

      <section aria-labelledby="shops-heading" className="card p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="shops-heading" className="font-display text-lg font-semibold">
            Shops
          </h2>
          <Link href="/admin/shops/new" className="btn btn-primary">
            Add shop
          </Link>
        </div>
        {shops.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No shops yet. Add one manually or run an OpenStreetMap sync below.
          </p>
        ) : (
          <ul>{shops.map((shop) => <Row key={shop.id} shop={shop} />)}</ul>
        )}
      </section>

      <section aria-labelledby="sync-heading" className="card p-4">
        <h2 id="sync-heading" className="font-display text-lg font-semibold">
          OpenStreetMap sync
        </h2>
        <p className="mb-3 text-sm text-muted">
          Imports barber shops tagged around {SERVICE_AREA.name}. Manually edited listings are never
          overwritten, and runs are limited to once an hour.
        </p>
        <SyncButton />
      </section>
    </div>
  );
}
