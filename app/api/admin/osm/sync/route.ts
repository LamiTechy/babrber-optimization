import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { fail, fromZodError, ok, serverError } from "@/lib/api/response";
import { runOsmImport } from "@/lib/osm/importShops";
import { OverpassUnavailableError } from "@/lib/osm/overpass";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ force: z.boolean().default(false) });

/** Manual sync from the admin dashboard (the hourly cron uses /api/cron/sync). */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  try {
    const text = await request.text();
    const parsed = bodySchema.safeParse(text ? JSON.parse(text) : {});
    if (!parsed.success) return fromZodError(parsed.error, 422);

    const report = await runOsmImport({ force: parsed.data.force });
    return ok({ report });
  } catch (error) {
    if (error instanceof OverpassUnavailableError) {
      return fail("upstream_unavailable", error.message, 502);
    }
    console.error("[osm-sync]", error);
    return serverError(error, "The OpenStreetMap sync could not run.");
  }
}
