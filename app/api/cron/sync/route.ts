import { NextRequest } from "next/server";
import { ok, fail, serverError } from "@/lib/api/response";
import { cronSecret } from "@/lib/env";
import { runOsmImport } from "@/lib/osm/importShops";
import { OverpassUnavailableError } from "@/lib/osm/overpass";

export const dynamic = "force-dynamic";

/** Vercel Cron (see vercel.json) calls this hourly with `Authorization: Bearer <CRON_SECRET>`. */
async function authorized(request: NextRequest): Promise<boolean> {
  const secret = cronSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  try {
    if (!(await authorized(request))) {
      return fail("unauthorized", "Missing or invalid cron secret.", 401);
    }
    const report = await runOsmImport({
      force: request.nextUrl.searchParams.get("force") === "1",
      source: "cron",
    });
    return ok({ report });
  } catch (error) {
    if (error instanceof OverpassUnavailableError) {
      return fail("upstream_unavailable", error.message, 502);
    }
    return serverError(error, "The scheduled OpenStreetMap sync failed.");
  }
}
