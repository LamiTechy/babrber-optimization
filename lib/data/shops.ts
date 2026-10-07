import { and, asc, eq, inArray, ne, type SQL } from "drizzle-orm";
import { SERVICE_AREA_CENTER, SERVICE_AREA_RADIUS_KM } from "@/lib/config";
import { getDb, type Database } from "@/lib/db";
import { services, shopHours, shopImages, shops, type Shop } from "@/lib/db/schema";
import { formatDistance, formatWalkingTime, haversineMeters, isWithinArea, walkingMinutes } from "@/lib/geo";
import {
  computeShopStatus,
  osmWeekHours,
  statusRank,
  wallClock,
  type HoursStatus,
  type WeekHours,
} from "@/lib/hours";
import { showSamples } from "@/lib/env";
import type {
  ServiceDto,
  ShopCardDto,
  ShopDetailDto,
  ShopHoursDayDto,
  StatusDto,
} from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function visibleShopsCondition(): SQL | undefined {
  return showSamples() ? undefined : ne(shops.source, "sample");
}

function baseCondition(): SQL {
  const clauses: (SQL | undefined)[] = [
    eq(shops.isPublished, true),
    eq(shops.isDeleted, false),
    visibleShopsCondition(),
  ];
  return and(...clauses.filter(Boolean) as SQL[])!;
}

export type HoursBundle = {
  days: WeekHours;
  source: "osm" | "manual" | "unknown";
  raw: string | null;
  override: { status: "open" | "closed"; until: Date | null } | null;
};

function emptyWeek(): WeekHours {
  return [[], [], [], [], [], [], []];
}

/** Weekly hours for a set of shops, keyed by shop id. */
export async function loadHours(
  db: Database,
  shopIds: string[],
): Promise<Map<string, HoursBundle>> {
  const out = new Map<string, HoursBundle>();
  if (!shopIds.length) return out;

  const rows = await db
    .select()
    .from(shopHours)
    .where(inArray(shopHours.shopId, shopIds))
    .orderBy(asc(shopHours.dayOfWeek), asc(shopHours.sortOrder));

  const byShop = new Map<string, WeekHours>();
  for (const row of rows) {
    const week = byShop.get(row.shopId) ?? emptyWeek();
    week[row.dayOfWeek].push({ open: row.openTime, close: row.closeTime });
    byShop.set(row.shopId, week);
  }

  const shopRows = await db
    .select({
      id: shops.id,
      hoursSource: shops.hoursSource,
      osmOpeningHours: shops.osmOpeningHours,
      overrideStatus: shops.overrideStatus,
      overrideUntil: shops.overrideUntil,
    })
    .from(shops)
    .where(inArray(shops.id, shopIds));

  for (const row of shopRows) {
    const manual = byShop.get(row.id);
    out.set(row.id, {
      days: manual ?? emptyWeek(),
      source: manual && manual.some((d) => d.length) ? "manual" : row.hoursSource,
      raw: row.osmOpeningHours,
      override:
        row.overrideStatus && row.overrideUntil && row.overrideUntil.getTime() > Date.now()
          ? { status: row.overrideStatus, until: row.overrideUntil }
          : row.overrideStatus && !row.overrideUntil
            ? { status: row.overrideStatus, until: null }
            : null,
    });
  }

  return out;
}

export function statusFor(bundle: HoursBundle | undefined, now: Date): HoursStatus {
  if (!bundle) {
    return computeShopStatus({ hoursSource: "unknown" }, now);
  }
  return computeShopStatus(
    {
      hoursSource: bundle.source,
      days: bundle.source === "manual" ? bundle.days : null,
      osmOpeningHours: bundle.raw,
      override: bundle.override,
    },
    now,
  );
}

function statusDto(status: HoursStatus): StatusDto {
  return {
    isOpen: status.isOpen,
    state: status.state,
    label: status.label,
    nextChange: status.nextChange,
  };
}

export async function loadServices(
  db: Database,
  shopIds: string[],
): Promise<Map<string, ServiceDto[]>> {
  const out = new Map<string, ServiceDto[]>();
  if (!shopIds.length) return out;

  const rows = await db
    .select()
    .from(services)
    .where(inArray(services.shopId, shopIds))
    .orderBy(asc(services.sortOrder), asc(services.name));

  for (const row of rows) {
    const list = out.get(row.shopId) ?? [];
    list.push({
      name: row.name,
      priceNaira: row.priceNaira,
      durationMinutes: row.durationMinutes,
    });
    out.set(row.shopId, list);
  }
  return out;
}

export type NearbyQuery = {
  lat: number;
  lng: number;
  openNow?: boolean;
  service?: string | null;
  maxKm?: number | null;
  sort?: "open" | "nearby";
};

export type NearbyResult = {
  outsideArea: boolean;
  reference: { lat: number; lng: number };
  shops: ShopCardDto[];
};

/** Nearest-barbers query: distance in memory (the dataset is tiny). */
export async function getNearbyShops(query: NearbyQuery, db?: Database): Promise<NearbyResult> {
  const conn: Database = db ?? (await getDb());
  const now = new Date();
  const requested = { lat: query.lat, lng: query.lng };
  const outsideArea = !isWithinArea(requested, SERVICE_AREA_CENTER, SERVICE_AREA_RADIUS_KM);
  const reference = outsideArea ? SERVICE_AREA_CENTER : requested;

  const rows = await conn
    .select()
    .from(shops)
    .where(baseCondition())
    .orderBy(asc(shops.name));

  const ids = rows.map((row) => row.id);
  const [hours, serviceMap] = await Promise.all([loadHours(conn, ids), loadServices(conn, ids)]);

  const serviceFilter = query.service?.trim().toLowerCase() ?? null;
  const sort = query.sort ?? "open";

  type Scored = { row: Shop; status: HoursStatus; distanceMeters: number; serviceList: ServiceDto[] };

  const scored: Scored[] = [];

  for (const row of rows) {
    const status = statusFor(hours.get(row.id), now);
    const distanceMeters = haversineMeters(reference, { lat: row.lat, lng: row.lng });
    const serviceList = serviceMap.get(row.id) ?? [];

    if (query.openNow && statusRank(status) !== 0) continue;
    if (query.maxKm && distanceMeters > query.maxKm * 1000) continue;
    if (
      serviceFilter &&
      !serviceList.some((service) => service.name.toLowerCase().includes(serviceFilter))
    ) {
      continue;
    }

    scored.push({ row, status, distanceMeters, serviceList });
  }

  scored.sort((a, b) => {
    if (sort === "open") {
      const rank = statusRank(a.status) - statusRank(b.status);
      if (rank !== 0) return rank;
    }
    return a.distanceMeters - b.distanceMeters;
  });

  return {
    outsideArea,
    reference,
    shops: scored.map(({ row, status, distanceMeters, serviceList }) =>
      toCardDto(row, status, distanceMeters, serviceList),
    ),
  };
}

function toCardDto(
  row: Shop,
  status: HoursStatus,
  distanceMeters: number,
  serviceList: ServiceDto[],
): ShopCardDto {
  const priceFrom = serviceList.length ? Math.min(...serviceList.map((s) => s.priceNaira)) : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    landmarkNote: row.landmarkNote,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone,
    whatsapp: row.whatsapp,
    coverImageUrl: row.coverImageUrl,
    amenities: row.amenities ?? [],
    distanceMeters: Math.round(distanceMeters),
    distanceLabel: formatDistance(distanceMeters),
    walkingMinutes: walkingMinutes(distanceMeters),
    walkingLabel: formatWalkingTime(distanceMeters),
    status: statusDto(status),
    priceFrom,
    services: serviceList,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    hoursSource: row.hoursSource,
  };
}

/** Full detail for `/shop/[slug]`, including the weekly hours table. */
export async function getShopBySlug(slug: string, db?: Database): Promise<ShopDetailDto | null> {
  const conn: Database = db ?? (await getDb());
  const now = new Date();
  const [row] = await conn
    .select()
    .from(shops)
    .where(and(eq(shops.slug, slug), baseCondition()))
    .limit(1);
  if (!row) return null;

  const [hours, serviceMap] = await Promise.all([
    loadHours(conn, [row.id]),
    loadServices(conn, [row.id]),
  ]);

  const bundle = hours.get(row.id);
  const status = statusFor(bundle, now);
  const serviceList = serviceMap.get(row.id) ?? [];

  const imageRows = await conn
    .select({ url: shopImages.url })
    .from(shopImages)
    .where(eq(shopImages.shopId, row.id))
    .orderBy(asc(shopImages.sortOrder));
  const images = imageRows.map((i) => i.url);

  let days: WeekHours = bundle?.days ?? emptyWeek();
  if (!days.some((day) => day.length) && row.hoursSource === "osm" && row.osmOpeningHours) {
    days = osmWeekHours(row.osmOpeningHours, now) ?? days;
  }
  const todayIndex = wallClock(now).dayOfWeek;

  const hourRows: ShopHoursDayDto[] = DAY_LABELS.map((label, dayOfWeek) => ({
    dayOfWeek,
    label,
    isToday: dayOfWeek === todayIndex,
    ranges: days[dayOfWeek] ?? [],
  }));

  const card = toCardDto(row, status, 0, serviceList);

  return {
    ...card,
    distanceMeters: 0,
    distanceLabel: "",
    walkingMinutes: 0,
    walkingLabel: "",
    description: row.description,
    images,
    galleryCount: images.length,
    hours: hourRows,
    osmOpeningHours: row.hoursSource === "osm" ? row.osmOpeningHours : null,
    source: row.source,
  };
}
