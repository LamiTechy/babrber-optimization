import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { fail, fromZodError, ok, serverError } from "@/lib/api/response";
import { getAdminShop, softDeleteShop, updateShop } from "@/lib/data/admin-shops";
import { updateShopSchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const shop = await getAdminShop(id);
    if (!shop) return fail("not_found", "That shop does not exist.", 404);
    return ok({ shop });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<Params> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const parsed = updateShopSchema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error, 422);

    const shop = await updateShop(id, parsed.data);
    if (!shop) return fail("not_found", "That shop does not exist.", 404);
    return ok({ shop });
  } catch (error) {
    return serverError(error, "Could not save the shop.");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const removed = await softDeleteShop(id);
    if (!removed) return fail("not_found", "That shop does not exist.", 404);
    return ok({ deleted: true });
  } catch (error) {
    return serverError(error, "Could not delete the shop.");
  }
}
