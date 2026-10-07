import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const overrideStatusEnum = pgEnum("override_status", ["closed", "open"]);
export const sourceEnum = pgEnum("shop_source", ["osm", "manual", "sample"]);
export const hoursSourceEnum = pgEnum("hours_source", ["osm", "manual", "unknown"]);

export const areas = pgTable("areas", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull().default("Ogun State"),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  radiusKm: doublePrecision("radius_km").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shops = pgTable(
  "shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    areaId: uuid("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    address: text("address"),
    landmarkNote: text("landmark_note"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    coverImageUrl: text("cover_image_url"),
    amenities: text("amenities").array().notNull().default([]),
    isPublished: boolean("is_published").notNull().default(true),
    isDeleted: boolean("is_deleted").notNull().default(false),
    overrideStatus: overrideStatusEnum("override_status"),
    overrideUntil: timestamp("override_until", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    source: sourceEnum("source").notNull().default("manual"),
    osmType: text("osm_type"),
    osmId: bigint("osm_id", { mode: "bigint" }),
    osmOpeningHours: text("osm_opening_hours"),
    hoursSource: hoursSourceEnum("hours_source").notNull().default("unknown"),
    isManuallyEdited: boolean("is_manually_edited").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("shops_published_deleted_idx").on(table.isPublished, table.isDeleted),
    uniqueIndex("shops_osm_type_osm_id_unique").on(table.osmType, table.osmId),
  ],
);

export const shopHours = pgTable(
  "shop_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    openTime: text("open_time").notNull(),
    closeTime: text("close_time").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("shop_hours_shop_day_idx").on(table.shopId, table.dayOfWeek)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceNaira: integer("price_naira").notNull(),
    durationMinutes: integer("duration_minutes"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("services_shop_idx").on(table.shopId)],
);

export const shopImages = pgTable("shop_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  shopId: uuid("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const landmarks = pgTable(
  "landmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    areaId: uuid("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default([]),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
  },
  (table) => [index("landmarks_area_idx").on(table.areaId)],
);

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per completed OSM import — drives the once-an-hour cooldown. */
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").notNull().default("manual"),
    found: integer("found").notNull().default(0),
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    hidden: integer("hidden").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    message: text("message"),
  },
  (table) => [index("sync_runs_ran_at_idx").on(table.ranAt)],
);

export type Area = typeof areas.$inferSelect;
export type Shop = typeof shops.$inferSelect;
export type ShopHour = typeof shopHours.$inferSelect;
export type Service = typeof services.$inferSelect;
export type ShopImage = typeof shopImages.$inferSelect;
export type Landmark = typeof landmarks.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
export type Admin = typeof admins.$inferSelect;

export type NewShop = typeof shops.$inferInsert;
export type NewShopHour = typeof shopHours.$inferInsert;
export type NewService = typeof services.$inferInsert;
export type NewShopImage = typeof shopImages.$inferInsert;
export type NewLandmark = typeof landmarks.$inferInsert;
