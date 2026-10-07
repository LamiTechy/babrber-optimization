import { eq } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import { areas, type Area } from "@/lib/db/schema";
import { SERVICE_AREA, SERVICE_AREA_RADIUS_KM } from "@/lib/config";

/** The single service area we launch with. Created on demand. */
export async function ensureArea(db?: Database): Promise<Area> {
  const conn: Database = db ?? (await getDb());
  const existing = await conn.select().from(areas).where(eq(areas.name, SERVICE_AREA.name));
  if (existing[0]) return existing[0];

  const [created] = await conn
    .insert(areas)
    .values({
      name: SERVICE_AREA.name,
      city: SERVICE_AREA.city,
      state: SERVICE_AREA.state,
      centerLat: SERVICE_AREA.centerLat,
      centerLng: SERVICE_AREA.centerLng,
      radiusKm: SERVICE_AREA_RADIUS_KM,
    })
    .returning();
  return created;
}
