"use client";

import Image from "next/image";
import { MAX_SHOP_IMAGES } from "@/lib/config";

function isAllowed(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    return /(^|\.)public\.blob\.vercel-storage\.com$/.test(url.hostname);
  } catch {
    return false;
  }
}

export function ShopGallery({ images, name }: { images: string[]; name: string }) {
  const usable = images.filter(isAllowed).slice(0, MAX_SHOP_IMAGES);

  if (usable.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2 text-sm text-muted">
        No photos yet — {name} has not added a gallery.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {usable.map((src) => (
        <li key={src} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-surface-2">
          <Image src={src} alt={`${name} photo`} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
        </li>
      ))}
    </ul>
  );
}
