import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";
import { ensureArea } from "@/lib/data/areas";
import { createShop, replaceHours } from "@/lib/data/admin-shops";
import { getDb, closeDb } from "@/lib/db";
import { landmarks, shops } from "@/lib/db/schema";
import { DIRECTORY_SHOPS } from "./data/directory";
import resolvedCoords from "./resolved-coords.json";

/**
 * One-off, idempotent: imports the TREM Ojere directory (16 shops + hours)
 * as source="manual" and adds Moshood Abiola Polytechnic as a landmark.
 * Coordinates come from resolve-maps.ts (exact Google Maps pins).
 */

loadEnv({ path: ".env.local" });
loadEnv();

type ResolvedFile = {
  trem: { lat: number; lng: number } | null;
  mapoly: { lat: number; lng: number } | null;
  shops: { name: string; cid: string; lat: number | null; lng: number | null }[];
};

const resolved = resolvedCoords as ResolvedFile;

/** `0814 833 3530` → `2348148333530`, matching the OSM importer's rule. */
function whatsappFrom(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  let wa = digits;
  if (wa.startsWith("0")) wa = `234${wa.slice(1)}`;
  else if (wa.startsWith("+234")) wa = wa.slice(1);
  if (!/^\d{10,15}$/.test(wa)) return null;
  return wa;
}

async function main() {
  if (!resolved.mapoly) {
    throw new Error("resolved-coords.json has no MAPOLY point — run scripts/resolve-maps.ts first.");
  }

  const db = await getDb();
  const area = await ensureArea(db);

  const coordsByName = new Map(
    resolved.shops
      .filter((s) => s.lat !== null && s.lng !== null)
      .map((s) => [s.name, { lat: s.lat as number, lng: s.lng as number }]),
  );

  const existingRows = await db.select({ name: shops.name, phone: shops.phone }).from(shops);
  const existingNames = new Set(existingRows.map((row) => row.name));
  const existingPhones = new Set(
    existingRows.map((row) => row.phone?.replace(/[^\d]/g, "")),
  );

  let created = 0;
  let skipped = 0;

  for (const shop of DIRECTORY_SHOPS) {
    const coords = coordsByName.get(shop.name);
    if (!coords) {
      console.log(`MISS ${shop.name} — no resolved coordinates, skipping.`);
      continue;
    }
    const phoneDigits = shop.phone?.replace(/[^\d]/g, "");
    if (existingNames.has(shop.name) || (phoneDigits && existingPhones.has(phoneDigits))) {
      skipped++;
      continue;
    }

    const detail = await createShop({
      name: shop.name,
      description: shop.website ?? null,
      address: shop.address,
      landmarkNote: null,
      lat: coords.lat,
      lng: coords.lng,
      phone: shop.phone,
      whatsapp: whatsappFrom(shop.phone),
      amenities: [],
      isPublished: true,
      hoursSource: shop.hoursSource,
    });

    if (shop.hoursSource === "manual") {
      await replaceHours(detail.id, shop.week);
    }

    created++;
    console.log(
      `ADD  ${shop.name.padEnd(30)} ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}  hours=${shop.hoursSource}`,
    );
  }

  const [landmarkRow] = await db
    .select({ id: landmarks.id })
    .from(landmarks)
    .where(eq(landmarks.name, "Moshood Abiola Polytechnic"))
    .limit(1);

  if (!landmarkRow) {
    await db.insert(landmarks).values({
      areaId: area.id,
      name: "Moshood Abiola Polytechnic",
      aliases: ["MAPOLY", "Moshood Abiola Poly", "MAPOLY Ojere", "Moshood Abiola Polytechnic Ojere"],
      lat: resolved.mapoly.lat,
      lng: resolved.mapoly.lng,
    });
    console.log(
      `ADD  landmark Moshood Abiola Polytechnic   ${resolved.mapoly.lat.toFixed(6)}, ${resolved.mapoly.lng.toFixed(6)}`,
    );
  } else {
    console.log("SKIP landmark Moshood Abiola Polytechnic (exists)");
  }

  console.log(`\nDone: ${created} shops created, ${skipped} already present.`);
  await closeDb();
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
