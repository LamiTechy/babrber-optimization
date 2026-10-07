import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { SERVICE_AREA, SERVICE_AREA_CENTER } from "@/lib/config";
import { ensureArea } from "@/lib/data/areas";
import { getDb, type Database } from "@/lib/db";
import { osmSyncRadiusKm } from "@/lib/env";
import { shops, syncRuns, type Shop } from "@/lib/db/schema";
import { isWithinArea } from "@/lib/geo";
import { slugify } from "@/lib/utils";
import { buildOverpassQuery, queryOverpass, type OverpassElement } from "./overpass";

/** How long a completed sync blocks another one (Overpass etiquette). */
const SYNC_COOLDOWN_MS = 60 * 60 * 1000;

export type SyncReport = {
  ranAt: string;
  found: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Present on the map before, gone now — hidden, never deleted. */
  hidden: number;
  skippedOutsideArea: number;
  skippedCooldown: boolean;
  durationMs: number;
  message: string;
};

export type OsmShopCandidate = {
  osmType: "node" | "way" | "relation";
  osmId: string;
  name: string;
  lat: number;
  lng: number;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  openingHours: string | null;
};

function firstTag(tags: Record<string, string> | undefined, ...keys: string[]): string | null {
  if (!tags) return null;
  for (const key of keys) {
    const value = tags[key]?.trim();
    if (value) return value;
  }
  return null;
}

/** `addr:*` tags into a single readable line. */
export function addressFromTags(tags?: Record<string, string>): string | null {
  if (!tags) return null;
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:neighbourhood"] ?? tags["addr:suburb"],
    tags["addr:city"] ?? tags["addr:place"],
  ].filter((part): part is string => Boolean(part && part.trim()));
  if (!parts.length) return null;
  return parts.map((part) => part.trim()).join(", ");
}

/** Nigerian numbers often arrive as `+234 ...` / `0803 ...` with spaces. */
function normalisePhone(raw: string | null): { phone: string | null; whatsapp: string | null } {
  if (!raw) return { phone: null, whatsapp: null };
  const cleaned = raw.replace(/[^\d+]/g, "").split(";")[0].trim();
  if (!cleaned) return { phone: null, whatsapp: null };

  let wa = cleaned;
  if (wa.startsWith("+234")) wa = `234${wa.slice(4)}`;
  else if (wa.startsWith("0")) wa = `234${wa.slice(1)}`;
  else if (wa.startsWith("234")) wa = wa;

  return { phone: cleaned, whatsapp: /^\d{10,15}$/.test(wa) ? wa : null };
}

export function elementToCandidate(element: OverpassElement): OsmShopCandidate | null {
  const lat = element.lat ?? element.center?.lat;
  // Overpass names the field `lon`; `lng` is accepted in case a mirror renames it.
  const lng = element.lon ?? element.lng ?? element.center?.lon ?? element.center?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const tags = element.tags ?? {};
  const { phone, whatsapp } = normalisePhone(firstTag(tags, "phone", "contact:phone", "contact:mobile"));

  return {
    osmType: element.type,
    osmId: String(element.id),
    name: firstTag(tags, "name", "name:en") ?? "Unnamed salon",
    lat,
    lng,
    phone,
    whatsapp,
    address: addressFromTags(tags),
    openingHours: firstTag(tags, "opening_hours", "opening_hours:weekday", "opening_hours:covid19"),
  };
}

async function lastSyncAt(db: Database): Promise<number> {
  const [latest] = await db
    .select({ at: syncRuns.ranAt })
    .from(syncRuns)
    .orderBy(desc(syncRuns.ranAt))
    .limit(1);
  return latest?.at ? latest.at.getTime() : 0;
}

async function uniqueSlug(db: Database, base: string, osmType: string, osmId: string): Promise<string> {
  const root = slugify(base) || "shop";
  let candidate = root;
  for (let suffix = 2; suffix < 100; suffix++) {
    const [taken] = await db
      .select({ id: shops.id })
      .from(shops)
      .where(eq(shops.slug, candidate))
      .limit(1);
    if (!taken) return candidate;
    candidate = `${root}-${suffix}`;
  }
  return `${root}-${osmType}-${osmId}`;
}

function changed(before: string | null, after: string | null): boolean {
  return (before ?? null) !== (after ?? null);
}

/**
 * Pulls barber shops around Ojere from OpenStreetMap and upserts them.
 *
 * Rules:
 * - Upsert key is `(osmType, osmId)`; re-running never creates duplicates.
 * - Manually edited shops are never overwritten — only `lastSyncedAt` moves.
 * - Shops missing from the map are hidden (`isPublished = false`), never deleted.
 * - Users never trigger this; the public site only reads the database.
 */
export async function runOsmImport(options?: {
  force?: boolean;
  db?: Database;
  now?: Date;
  source?: "manual" | "cron";
}): Promise<SyncReport> {
  const started = Date.now();
  const db = options?.db ?? (await getDb());
  const now = options?.now ?? new Date();

  const base = { ranAt: now.toISOString(), skippedCooldown: false, durationMs: 0 };

  if (!options?.force) {
    const last = await lastSyncAt(db);
    if (last && now.getTime() - last < SYNC_COOLDOWN_MS) {
      return {
        ...base,
        found: 0,
        created: 0,
        updated: 0,
        unchanged: 0,
        hidden: 0,
        skippedOutsideArea: 0,
        skippedCooldown: true,
        durationMs: Date.now() - started,
        message: "Skipped: a sync already ran in the last hour. Use force to run again.",
      };
    }
  }

  const area = await ensureArea(db);
  const syncRadiusKm = osmSyncRadiusKm();
  const query = buildOverpassQuery(
    Math.round(syncRadiusKm * 1000),
    SERVICE_AREA.centerLat,
    SERVICE_AREA.centerLng,
  );

  const elements = await queryOverpass(query);
  const candidates: OsmShopCandidate[] = [];
  let skippedOutsideArea = 0;

  for (const element of elements) {
    const candidate = elementToCandidate(element);
    if (!candidate) continue;
    if (!isWithinArea(candidate, SERVICE_AREA_CENTER, syncRadiusKm)) {
      skippedOutsideArea++;
      continue;
    }
    candidates.push(candidate);
  }

  const seenIds = new Set(candidates.map((c) => `${c.osmType}/${c.osmId}`));

  const existingRows = await db
    .select()
    .from(shops)
    .where(and(isNotNull(shops.osmType), isNotNull(shops.osmId)));
  const existingByKey = new Map(existingRows.map((row) => [`${row.osmType}/${row.osmId}`, row]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const candidate of candidates) {
    const key = `${candidate.osmType}/${candidate.osmId}`;
    const existing = existingByKey.get(key);
    const hoursSource = candidate.openingHours ? "osm" : "unknown";

    if (!existing) {
      const slug = await uniqueSlug(db, candidate.name, candidate.osmType, candidate.osmId);
      await db.insert(shops).values({
        areaId: area.id,
        slug,
        name: candidate.name,
        lat: candidate.lat,
        lng: candidate.lng,
        phone: candidate.phone,
        whatsapp: candidate.whatsapp,
        address: candidate.address,
        source: "osm",
        isPublished: true,
        isDeleted: false,
        osmType: candidate.osmType,
        osmId: BigInt(candidate.osmId),
        osmOpeningHours: candidate.openingHours,
        hoursSource,
        isManuallyEdited: false,
        lastSyncedAt: now,
      });
      created++;
      continue;
    }

    if (existing.isManuallyEdited) {
      await db
        .update(shops)
        .set({ lastSyncedAt: now, updatedAt: now })
        .where(eq(shops.id, existing.id));
      unchanged++;
      continue;
    }

    const touchesRow =
      changed(existing.name, candidate.name) ||
      Math.abs(existing.lat - candidate.lat) > 1e-7 ||
      Math.abs(existing.lng - candidate.lng) > 1e-7 ||
      changed(existing.phone, candidate.phone) ||
      changed(existing.address, candidate.address) ||
      changed(existing.osmOpeningHours, candidate.openingHours);

    if (!touchesRow) {
      await db.update(shops).set({ lastSyncedAt: now, updatedAt: now }).where(eq(shops.id, existing.id));
      unchanged++;
      continue;
    }

    await db
      .update(shops)
      .set({
        name: candidate.name,
        lat: candidate.lat,
        lng: candidate.lng,
        phone: candidate.phone,
        whatsapp: candidate.whatsapp,
        address: candidate.address,
        osmOpeningHours: candidate.openingHours,
        hoursSource,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(shops.id, existing.id));
    updated++;
  }

  // Anything that was on the map before and is gone now gets hidden.
  let hidden = 0;
  for (const row of existingRows) {
    const key = `${row.osmType}/${row.osmId}`;
    if (seenIds.has(key)) continue;
    if (!row.isPublished) continue;
    await db
      .update(shops)
      .set({ isPublished: false, updatedAt: now })
      .where(and(eq(shops.id, row.id), eq(shops.source, "osm"), ne(shops.isManuallyEdited, true)));
    hidden++;
  }

  const found = elements.length;
  let message = `Found ${found} shops on the map: ${created} new, ${updated} updated, ${unchanged} unchanged, ${hidden} hidden.`;
  if (found === 0) {
    message =
      "Only 0 shops found on the map. OSM coverage around Ojere is thin — add the rest manually in the admin.";
  }

  const durationMs = Date.now() - started;

  // One row per completed run: drives the once-an-hour cooldown even when the
  // map returned nothing to import.
  await db.insert(syncRuns).values({
    ranAt: now,
    source: options?.source ?? "manual",
    found,
    created,
    updated,
    hidden,
    durationMs,
    message,
  });

  return {
    ...base,
    found,
    created,
    updated,
    unchanged,
    hidden,
    skippedOutsideArea,
    durationMs,
    message,
  };
}

/** Used by the admin UI to tell "map shop" from "manual shop". */
export function isOsmShop(shop: Pick<Shop, "source">): boolean {
  return shop.source === "osm";
}
