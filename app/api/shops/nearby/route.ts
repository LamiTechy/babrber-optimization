import { z } from "zod";
import { getNearbyShops } from "@/lib/data/shops";
import { fail, fromZodError, ok, serverError } from "@/lib/api/response";
import type { NearbyResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  openNow: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  service: z.string().trim().max(60).optional(),
  maxKm: z.coerce.number().positive().max(50).optional(),
  sort: z.enum(["open", "nearby"]).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const result = await getNearbyShops({
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      openNow: parsed.data.openNow,
      service: parsed.data.service ?? null,
      maxKm: parsed.data.maxKm ?? null,
      sort: parsed.data.sort,
    });

    const payload: NearbyResponse = {
      outsideArea: result.outsideArea,
      reference: result.reference,
      count: result.shops.length,
      shops: result.shops,
    };
    return ok(payload);
  } catch (error) {
    return serverError(error, "We could not load shops right now. Try again shortly.");
  }
}

export function POST() {
  return fail("method_not_allowed", "Use GET with lat and lng query parameters.", 405);
}
