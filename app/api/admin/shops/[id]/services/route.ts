import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { fromZodError, ok, serverError } from "@/lib/api/response";
import { replaceServices } from "@/lib/data/admin-shops";
import { servicesSchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Replaces the whole price list for one shop. */
export async function PUT(request: NextRequest, { params }: { params: Promise<Params> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const parsed = servicesSchema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error, 422);

    await replaceServices(id, parsed.data);
    return ok({ saved: true });
  } catch (error) {
    return serverError(error, "Could not save the price list.");
  }
}
