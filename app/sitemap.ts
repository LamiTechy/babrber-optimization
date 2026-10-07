import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";
import { siteUrl } from "@/lib/config";
import { getDb } from "@/lib/db";
import { shops } from "@/lib/db/schema";

async function shopEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ slug: shops.slug, updatedAt: shops.updatedAt })
      .from(shops)
      .where(eq(shops.isPublished, true))
      .orderBy(desc(shops.updatedAt))
      .limit(500);

    return rows.map((row) => ({
      url: siteUrl(`/shop/${row.slug}`),
      lastModified: row.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // No database available while building — ship the static pages only.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/about"), changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    ...(await shopEntries()),
  ];
}
