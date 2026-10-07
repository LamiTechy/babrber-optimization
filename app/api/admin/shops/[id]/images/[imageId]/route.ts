import { NextRequest } from "next/server";
import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin/guard";
import { fail, ok, serverError } from "@/lib/api/response";
import { removeImage, touchCover } from "@/lib/data/admin-shops";

export const dynamic = "force-dynamic";

type Params = { id: string; imageId: string };

export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  try {
    const { id, imageId } = await params;
    const url = await removeImage(id, imageId);
    if (!url) return fail("not_found", "That photo does not exist.", 404);

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      await del(url, { token }).catch(() => undefined);
    }

    await touchCover(id);
    return ok({ deleted: true });
  } catch (error) {
    return serverError(error, "Could not delete that photo.");
  }
}
