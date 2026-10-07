import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { fromZodError, ok, serverError } from "@/lib/api/response";
import { replaceHours } from "@/lib/data/admin-shops";
import { weekHoursSchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Replaces the whole week (Sunday first). An empty day means closed. */
export async function PUT(request: NextRequest, { params }: { params: Promise<Params> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const parsed = weekHoursSchema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error, 422);

    await replaceHours(id, parsed.data);
    return ok({ saved: true });
  } catch (error) {
    return serverError(error, "Could not save opening hours.");
  }
}
