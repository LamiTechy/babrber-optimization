import { getShopBySlug } from "@/lib/data/shops";
import { fail, ok, serverError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const shop = await getShopBySlug(slug);
    if (!shop) return fail("not_found", "That shop could not be found.", 404);
    return ok(shop);
  } catch (error) {
    return serverError(error, "We could not load this shop right now.");
  }
}
