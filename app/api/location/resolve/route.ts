import { z } from "zod";
import { fail, fromZodError, ok, serverError } from "@/lib/api/response";
import { getDb } from "@/lib/db";
import { landmarks } from "@/lib/db/schema";
import { resolveLocation } from "@/lib/location/resolve";
import type { ResolveResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  input: z.string().trim().min(1, "Type a place, paste a link, or drop a pin.").max(500),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("invalid_json", "Expected a JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const db = await getDb();
    const rows = await db.select().from(landmarks);
    const result = await resolveLocation(
      parsed.data.input,
      rows.map((row) => ({ name: row.name, aliases: row.aliases, lat: row.lat, lng: row.lng })),
    );

    if (!result.ok) return fail(result.code, result.message, result.code === "empty" ? 400 : 422);

    const data: ResolveResponse = {
      lat: result.lat,
      lng: result.lng,
      source: result.source,
    };
    return ok(data);
  } catch (error) {
    return serverError(error, "We could not read that location. Try a landmark instead.");
  }
}
