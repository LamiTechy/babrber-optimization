import { NextRequest } from "next/server";
import { del, put } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin/guard";
import { fail, ok, serverError } from "@/lib/api/response";
import { addImage, touchCover } from "@/lib/data/admin-shops";
import { MAX_SHOP_IMAGES } from "@/lib/config";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { id: string };

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return fail("invalid_file", "Choose an image to upload.", 422);
    }
    const extension = ALLOWED[file.type];
    if (!extension) {
      return fail("invalid_file", "Only JPEG, PNG, WebP, AVIF or GIF images are supported.", 422);
    }
    if (file.size > MAX_BYTES) {
      return fail("too_large", "Images must be 5 MB or smaller.", 422);
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return fail(
        "storage_unavailable",
        "Photo uploads are disabled: set BLOB_READ_WRITE_TOKEN (see .env.example).",
        503,
      );
    }

    const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "photo";
    const blob = await put(`shops/${id}/${Date.now()}-${base}${extension}`, file, {
      access: "public",
      token,
    });

    const image = await addImage(id, blob.url);
    if (!image) {
      await del(blob.url, { token }).catch(() => undefined);
      return fail("too_many_images", `A shop can have at most ${MAX_SHOP_IMAGES} photos.`, 422);
    }

    await touchCover(id);
    return ok({ image }, { status: 201 });
  } catch (error) {
    return serverError(error, "Could not upload that image.");
  }
}
