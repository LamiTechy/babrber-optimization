import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopForm } from "@/components/admin/shop-form";
import { getAdminShop } from "@/lib/data/admin-shops";
import { toAdminShopFormState } from "@/lib/admin/serialize";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const shop = await getAdminShop(id);
  return {
    title: shop ? `Edit ${shop.name}` : "Edit shop",
    robots: { index: false, follow: false },
  };
}

export default async function EditShopPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const shop = await getAdminShop(id);
  if (!shop) notFound();

  const state = toAdminShopFormState(shop);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{shop.name}</h1>
          <p className="text-sm text-muted">
            Source: {shop.source === "osm" ? "OpenStreetMap" : shop.source === "sample" ? "Sample" : "Manual"}
            {" · "}
            <Link href={`/shop/${shop.slug}`} className="underline underline-offset-2">
              View public page
            </Link>
          </p>
        </div>
        <span className={`badge ${shop.isDeleted ? "badge-closed" : shop.isPublished ? "badge-open" : "badge-soon"}`}>
          {shop.isDeleted ? "Deleted" : shop.isPublished ? "Live" : "Draft"}
        </span>
      </div>
      <ShopForm shop={state} />
    </div>
  );
}
