import { ShopForm } from "@/components/admin/shop-form";

export const dynamic = "force-dynamic";

export default function NewShopPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Add a shop</h1>
        <p className="text-sm text-muted">
          Coordinates are required — drop a pin in the public map view or paste them from Google
          Maps.
        </p>
      </div>
      <ShopForm shop={null} />
    </div>
  );
}
