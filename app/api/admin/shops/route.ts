import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { fromZodError, ok, serverError } from "@/lib/api/response";
import { createShop, listAdminShops } from "@/lib/data/admin-shops";
import { createShopSchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  try {
    return ok({ shops: await listAdminShops() });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  try {
    const parsed = createShopSchema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error, 422);

    const shop = await createShop(parsed.data);
    return ok({ shop }, { status: 201 });
  } catch (error) {
    return serverError(error, "Could not create the shop.");
  }
}
