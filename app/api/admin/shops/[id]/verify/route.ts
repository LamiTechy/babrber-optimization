import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { fail, ok, serverError } from "@/lib/api/response";
import { getAdminShop, touchVerified } from "@/lib/data/admin-shops";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Marks the listing as checked today (shown on the public shop page). */
export async function POST(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const shop = await getAdminShop(id);
    if (!shop) return fail("not_found", "That shop does not exist.", 404);
    await touchVerified(id);
    return ok({ saved: true });
  } catch (error) {
    return serverError(error, "Could not update the shop.");
  }
}
