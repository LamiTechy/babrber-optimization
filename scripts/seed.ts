import "dotenv/config";
import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SERVICE_AREA, SERVICE_AREA_CENTER, SERVICE_AREA_RADIUS_KM } from "@/lib/config";
import { ensureArea } from "@/lib/data/areas";
import { closeDb, getDb, schema } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { isWithinArea } from "@/lib/geo";

loadEnv({ path: ".env.local" });
loadEnv();

/**
 * Seed: one area, a placeholder landmark list and five clearly-labelled
 * sample shops (only shown while SHOW_SAMPLES=true).
 *
 * Idempotent — safe to run more than once.
 */

const LANDMARKS = [
  // TODO: replace with real coordinates
  { name: "Ojere Market", aliases: ["Ojere market", "Ojere"], lat: 7.1501, lng: 3.3502 },
  // TODO: replace with real coordinates
  { name: "Ojere Health Centre", aliases: ["Ojere clinic"], lat: 7.1468, lng: 3.3665 },
  // TODO: replace with real coordinates
  { name: "Sagamu Road Junction", aliases: ["Sagamu junction"], lat: 7.1402, lng: 3.3701 },
  // TODO: replace with real coordinates
  { name: "Baptist Medical Centre", aliases: ["BMC", "Ogun State Hospital"], lat: 7.1355, lng: 3.3555 },
  // TODO: replace with real coordinates
  { name: "Ojere Police Station", aliases: ["police station"], lat: 7.153, lng: 3.358 },
  // TODO: replace with real coordinates
  { name: "Ake Road Roundabout", aliases: ["Ake roundabout"], lat: 7.142, lng: 3.348 },
  // TODO: replace with real coordinates
  { name: "Ojere Primary School", aliases: ["primary school"], lat: 7.1495, lng: 3.372 },
  // TODO: replace with real coordinates
  { name: "Ibara Housing Estate Gate", aliases: ["Ibara gate"], lat: 7.138, lng: 3.35 },
  // TODO: replace with real coordinates
  { name: "Quarry Road Junction", aliases: ["Quarry junction"], lat: 7.155, lng: 3.365 },
  // TODO: replace with real coordinates
  { name: "Ojere Community Hall", aliases: ["community hall"], lat: 7.1445, lng: 3.3555 },
];

type SampleShop = {
  slug: string;
  name: string;
  description: string;
  landmarkNote: string;
  lat: number;
  lng: number;
  phone: string;
  whatsapp: string;
  amenities: string[];
  hoursSource: "manual" | "unknown";
  hours: { day: number; open: string; close: string; order?: number }[];
  services: { name: string; priceNaira: number; durationMinutes?: number }[];
};

const SAMPLE_SHOPS: SampleShop[] = [
  {
    slug: "classic-blades-ojere",
    name: "Classic Blades",
    description: "Old-school cuts and hot towel shaves, five minutes from Ojere market.",
    landmarkNote: "Beside the yellow filling station, opposite the market gate.",
    lat: 7.1494,
    lng: 3.3528,
    phone: "+234 803 000 0001",
    whatsapp: "2348030000001",
    amenities: ["Generator / power backup", "Accepts transfer & POS", "Walk-ins welcome"],
    hoursSource: "manual",
    // Mon–Sat, closed on Sunday (no rows for day 0).
    hours: [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "08:00", close: "21:00" })),
    services: [
      { name: "Haircut", priceNaira: 1500, durationMinutes: 30 },
      { name: "Beard trim", priceNaira: 800, durationMinutes: 15 },
      { name: "Kids cut", priceNaira: 1200, durationMinutes: 30 },
      { name: "Hot shave", priceNaira: 1000, durationMinutes: 20 },
    ],
  },
  {
    slug: "ojere-fade-house",
    name: "Ojere Fade House",
    description: "Skin fades, tapers and line-ups. Split shift — closed in the afternoon.",
    landmarkNote: "Turn at the bakery, first street on the left, blue gate.",
    lat: 7.1462,
    lng: 3.3641,
    phone: "+234 805 000 0002",
    whatsapp: "2348050000002",
    amenities: ["Air conditioning", "TV / football", "Appointment only"],
    hoursSource: "manual",
    // Split shift every day: 08:00–13:00 and 15:00–21:00.
    hours: [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
      { day, open: "08:00", close: "13:00", order: 0 },
      { day, open: "15:00", close: "21:00", order: 1 },
    ]),
    services: [
      { name: "Haircut", priceNaira: 2000, durationMinutes: 40 },
      { name: "Line up", priceNaira: 500, durationMinutes: 15 },
      { name: "Hair dye", priceNaira: 3500, durationMinutes: 60 },
    ],
  },
  {
    slug: "kings-touch-ojere",
    name: "Kings Touch Barbing",
    description: "Late-night cuts for people coming back from work. Open till 1am.",
    landmarkNote: "Close to the bus stop, look for the gold signboard.",
    lat: 7.1412,
    lng: 3.3672,
    phone: "+234 802 000 0003",
    whatsapp: "2348020000003",
    amenities: ["Generator / power backup", "Accepts transfer & POS", "Wi-Fi"],
    hoursSource: "manual",
    // Closes after midnight (10:00 → 01:00), Monday to Saturday.
    hours: [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "10:00", close: "01:00" })),
    services: [
      { name: "Haircut", priceNaira: 1800, durationMinutes: 30 },
      { name: "Dreadlocks", priceNaira: 6000, durationMinutes: 90 },
      { name: "Beard trim", priceNaira: 700, durationMinutes: 15 },
    ],
  },
  {
    slug: "the-sharp-line-ojere",
    name: "The Sharp Line",
    description: "Family shop — fathers and sons welcome. Sunday service from noon.",
    landmarkNote: "Inside the community hall compound, second room.",
    lat: 7.1448,
    lng: 3.3561,
    phone: "+234 806 000 0004",
    whatsapp: "2348060000004",
    amenities: ["Walk-ins welcome", "Kids friendly", "Generator / power backup"],
    hoursSource: "manual",
    hours: [
      { day: 0, open: "12:00", close: "18:00" },
      ...[1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "09:00", close: "19:00" })),
    ],
    services: [
      { name: "Kids cut", priceNaira: 1000, durationMinutes: 30 },
      { name: "Haircut", priceNaira: 1500, durationMinutes: 30 },
      { name: "Beard trim", priceNaira: 600, durationMinutes: 15 },
    ],
  },
  {
    slug: "elegant-touch-salon-ojere",
    name: "Elegant Touch Salon",
    description: "Ladies and gents. Call first — the board outside is often wrong.",
    landmarkNote: "Behind the chemist, purple building.",
    lat: 7.1389,
    lng: 3.3587,
    phone: "+234 809 000 0005",
    whatsapp: "2348090000005",
    amenities: ["Air conditioning", "Accepts transfer & POS", "Appointment only"],
    hoursSource: "unknown",
    hours: [],
    services: [
      { name: "Haircut", priceNaira: 2500, durationMinutes: 45 },
      { name: "Hair dye", priceNaira: 4000, durationMinutes: 75 },
      { name: "Shaving", priceNaira: 900, durationMinutes: 20 },
    ],
  },
];

async function seedAdmin() {
  const db = await getDb();
  const email = requireEnv("ADMIN_EMAIL").trim().toLowerCase();
  const password = requireEnv("ADMIN_PASSWORD");

  const [existing] = await db
    .select()
    .from(schema.admins)
    .where(eq(schema.admins.email, email))
    .limit(1);

  if (existing) {
    console.log(`• Admin already exists: ${email} (password unchanged)`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(schema.admins).values({ email, passwordHash });
  console.log(`• Created admin: ${email}`);
}

async function seedLandmarks(areaId: string) {
  const db = await getDb();
  const existing = await db.select().from(schema.landmarks).where(eq(schema.landmarks.areaId, areaId));
  const known = new Set(existing.map((row) => row.name));
  let created = 0;

  for (const landmark of LANDMARKS) {
    if (known.has(landmark.name)) continue;
    await db.insert(schema.landmarks).values({ areaId, ...landmark });
    created++;
  }
  console.log(`• Landmarks: ${existing.length} existing, ${created} added`);
}

async function seedSampleShops(areaId: string) {
  const db = await getDb();
  let created = 0;

  for (const sample of SAMPLE_SHOPS) {
    if (!isWithinArea(sample, SERVICE_AREA_CENTER, SERVICE_AREA_RADIUS_KM)) {
      console.warn(`  ! skipped ${sample.name}: outside the Ojere boundary`);
      continue;
    }

    const [existing] = await db
      .select({ id: schema.shops.id })
      .from(schema.shops)
      .where(eq(schema.shops.slug, sample.slug))
      .limit(1);
    if (existing) continue;

    const [shop] = await db
      .insert(schema.shops)
      .values({
        areaId,
        slug: sample.slug,
        name: sample.name,
        description: sample.description,
        landmarkNote: sample.landmarkNote,
        address: `Ojere, ${SERVICE_AREA.city}, ${SERVICE_AREA.state}`,
        lat: sample.lat,
        lng: sample.lng,
        phone: sample.phone,
        whatsapp: sample.whatsapp,
        amenities: sample.amenities,
        source: "sample",
        isPublished: true,
        isDeleted: false,
        hoursSource: sample.hoursSource,
        lastVerifiedAt: new Date(),
      })
      .returning();

    if (sample.hours.length) {
      await db.insert(schema.shopHours).values(
        sample.hours.map((hour) => ({
          shopId: shop.id,
          dayOfWeek: hour.day,
          openTime: hour.open,
          closeTime: hour.close,
          sortOrder: hour.order ?? 0,
        })),
      );
    }

    await db.insert(schema.services).values(
      sample.services.map((service, index) => ({
        shopId: shop.id,
        name: service.name,
        priceNaira: service.priceNaira,
        durationMinutes: service.durationMinutes ?? null,
        sortOrder: index,
      })),
    );

    created++;
  }
  console.log(`• Sample shops: ${created} created (visible only when SHOW_SAMPLES=true)`);
}

async function main() {
  const db = await getDb();
  const area = await ensureArea(db);
  console.log(`• Area: ${area.name}, ${area.city} (radius ${area.radiusKm} km)`);

  await seedAdmin();
  await seedLandmarks(area.id);
  await seedSampleShops(area.id);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
