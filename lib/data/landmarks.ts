import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { landmarks } from "@/lib/db/schema";

export type LandmarkDto = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

/** Known places inside the service area — the fallback when GPS is refused. */
export async function getLandmarks(): Promise<LandmarkDto[]> {
  const db = await getDb();
  const rows = await db.select().from(landmarks).orderBy(asc(landmarks.name));
  return rows.map((row) => ({ id: row.id, name: row.name, lat: row.lat, lng: row.lng }));
}
