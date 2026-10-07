import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { ensureArea } from "@/lib/data/areas";
import { getDb } from "@/lib/db";
import { services, shopHours, shopImages, shops, type Shop } from "@/lib/db/schema";
import { slugify } from "@/lib/utils";
import { MAX_SHOP_IMAGES } from "@/lib/config";
import type { CreateShopInput, ServiceInput, UpdateShopInput } from "@/lib/validation/admin";

export type AdminShopListItem = {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  isPublished: boolean;
  isDeleted: boolean;
  source: Shop["source"];
  hoursSource: Shop["hoursSource"];
  phone: string | null;
  lastVerifiedAt: Date | null;
  serviceCount: number;
  imageCount: number;
};

export type AdminHoursRange = { open: string; close: string };

export type AdminShopDetail = Shop & {
  hours: { dayOfWeek: number; ranges: AdminHoursRange[] }[];
  servicesList: ServiceInput[];
  images: { id: string; url: string; sortOrder: number }[];
};

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const db = await getDb();
  const root = slugify(base) || "shop";
  for (let suffix = 1; suffix <= 50; suffix++) {
    const candidate = suffix === 1 ? root : `${root}-${suffix}`;
    const [taken] = await db
      .select({ id: shops.id })
      .from(shops)
      .where(eq(shops.slug, candidate))
      .limit(1);
    if (!taken || taken.id === excludeId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function listAdminShops(): Promise<AdminShopListItem[]> {
  const db = await getDb();
  const rows = await db.select().from(shops).orderBy(asc(shops.name));

  const ids = rows.map((row) => row.id);
  const [serviceRows, imageRows] = await Promise.all([
    ids.length
      ? db
          .select({ shopId: services.shopId, count: sql<number>`count(*)::int` })
          .from(services)
          .where(inArray(services.shopId, ids))
          .groupBy(services.shopId)
      : Promise.resolve([]),
    ids.length
      ? db
          .select({ shopId: shopImages.shopId, count: sql<number>`count(*)::int` })
          .from(shopImages)
          .where(inArray(shopImages.shopId, ids))
          .groupBy(shopImages.shopId)
      : Promise.resolve([]),
  ]);

  const serviceCounts = new Map(serviceRows.map((row) => [row.shopId, row.count]));
  const imageCounts = new Map(imageRows.map((row) => [row.shopId, row.count]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    lat: row.lat,
    lng: row.lng,
    isPublished: row.isPublished,
    isDeleted: row.isDeleted,
    source: row.source,
    hoursSource: row.hoursSource,
    phone: row.phone,
    lastVerifiedAt: row.lastVerifiedAt,
    serviceCount: serviceCounts.get(row.id) ?? 0,
    imageCount: imageCounts.get(row.id) ?? 0,
  }));
}

export async function getAdminShop(id: string): Promise<AdminShopDetail | null> {
  const db = await getDb();
  const [row] = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  if (!row) return null;

  const [hourRows, serviceRows, imageRows] = await Promise.all([
    db
      .select()
      .from(shopHours)
      .where(eq(shopHours.shopId, id))
      .orderBy(asc(shopHours.dayOfWeek), asc(shopHours.sortOrder)),
    db
      .select()
      .from(services)
      .where(eq(services.shopId, id))
      .orderBy(asc(services.sortOrder), asc(services.name)),
    db
      .select({ id: shopImages.id, url: shopImages.url, sortOrder: shopImages.sortOrder })
      .from(shopImages)
      .where(eq(shopImages.shopId, id))
      .orderBy(asc(shopImages.sortOrder)),
  ]);

  const byDay = new Map<number, AdminHoursRange[]>();
  for (const row of hourRows) {
    const list = byDay.get(row.dayOfWeek) ?? [];
    list.push({ open: row.openTime, close: row.closeTime });
    byDay.set(row.dayOfWeek, list);
  }

  return {
    ...row,
    hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      ranges: byDay.get(dayOfWeek) ?? [],
    })),
    servicesList: serviceRows.map((service) => ({
      name: service.name,
      priceNaira: service.priceNaira,
      durationMinutes: service.durationMinutes,
    })),
    images: imageRows,
  };
}

export async function createShop(input: CreateShopInput): Promise<AdminShopDetail> {
  const db = await getDb();
  const area = await ensureArea(db);
  const slug = await uniqueSlug(input.name);

  const [row] = await db
    .insert(shops)
    .values({
      areaId: area.id,
      slug,
      name: input.name,
      description: input.description,
      address: input.address,
      landmarkNote: input.landmarkNote,
      lat: input.lat,
      lng: input.lng,
      phone: input.phone,
      whatsapp: input.whatsapp,
      amenities: input.amenities,
      isPublished: input.isPublished,
      source: "manual",
      hoursSource: input.hoursSource,
      isManuallyEdited: true,
      lastVerifiedAt: new Date(),
    })
    .returning();

  if (!row) throw new Error("Shop was not created");
  const detail = await getAdminShop(row.id);
  if (!detail) throw new Error("Shop was not created");
  return detail;
}

export async function updateShop(
  id: string,
  input: UpdateShopInput,
): Promise<AdminShopDetail | null> {
  const db = await getDb();
  const [existing] = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  if (!existing) return null;

  const slug = existing.name === input.name ? existing.slug : await uniqueSlug(input.name, id);

  await db
    .update(shops)
    .set({
      name: input.name,
      slug,
      description: input.description,
      address: input.address,
      landmarkNote: input.landmarkNote,
      lat: input.lat,
      lng: input.lng,
      phone: input.phone,
      whatsapp: input.whatsapp,
      amenities: input.amenities,
      isPublished: input.isPublished,
      hoursSource: input.hoursSource,
      overrideStatus: input.overrideStatus,
      overrideUntil: input.overrideUntil ? new Date(input.overrideUntil) : null,
      isManuallyEdited: true,
      updatedAt: new Date(),
    })
    .where(eq(shops.id, id));

  return getAdminShop(id);
}

export async function softDeleteShop(id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(shops)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(shops.id, id))
    .returning({ id: shops.id });
  return rows.length > 0;
}

export async function replaceHours(id: string, week: AdminHoursRange[][]): Promise<void> {
  const db = await getDb();
  await db.delete(shopHours).where(eq(shopHours.shopId, id));

  const values = week.flatMap((ranges, dayOfWeek) =>
    ranges.map((range, index) => ({
      shopId: id,
      dayOfWeek,
      openTime: range.open,
      closeTime: range.close,
      sortOrder: index,
    })),
  );

  if (values.length) await db.insert(shopHours).values(values);

  const hasManual = values.length > 0;
  await db
    .update(shops)
    .set({ hoursSource: hasManual ? "manual" : "unknown", updatedAt: new Date() })
    .where(eq(shops.id, id));
}

export async function replaceServices(id: string, list: ServiceInput[]): Promise<void> {
  const db = await getDb();
  await db.delete(services).where(eq(services.shopId, id));
  if (!list.length) return;

  await db.insert(services).values(
    list.map((service, index) => ({
      shopId: id,
      name: service.name,
      priceNaira: service.priceNaira,
      durationMinutes: service.durationMinutes ?? null,
      sortOrder: index,
    })),
  );
}

export async function touchVerified(id: string): Promise<void> {
  const db = await getDb();
  await db
    .update(shops)
    .set({ lastVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(shops.id, id));
}

export async function addImage(id: string, url: string): Promise<{ id: string; url: string } | null> {
  const db = await getDb();
  const existing = await db
    .select({ id: shopImages.id, sortOrder: shopImages.sortOrder })
    .from(shopImages)
    .where(eq(shopImages.shopId, id))
    .orderBy(desc(shopImages.sortOrder))
    .limit(1);

  const nextOrder = (existing[0]?.sortOrder ?? -1) + 1;
  if (nextOrder >= MAX_SHOP_IMAGES) return null;

  const [row] = await db
    .insert(shopImages)
    .values({ shopId: id, url, sortOrder: nextOrder })
    .returning({ id: shopImages.id, url: shopImages.url });
  if (row) await touchVerified(id);
  return row ?? null;
}

export async function removeImage(id: string, imageId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .delete(shopImages)
    .where(and(eq(shopImages.id, imageId), eq(shopImages.shopId, id)))
    .returning({ url: shopImages.url });
  return row?.url ?? null;
}

export async function touchCover(id: string): Promise<void> {
  const db = await getDb();
  const [first] = await db
    .select({ url: shopImages.url })
    .from(shopImages)
    .where(eq(shopImages.shopId, id))
    .orderBy(asc(shopImages.sortOrder))
    .limit(1);
  await db
    .update(shops)
    .set({ coverImageUrl: first?.url ?? null, updatedAt: new Date() })
    .where(eq(shops.id, id));
}
