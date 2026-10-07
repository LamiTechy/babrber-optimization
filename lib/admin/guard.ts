import { NextResponse } from "next/server";
import { getSession, type AdminSession } from "@/lib/auth";
import { fail } from "@/lib/api/response";

/**
 * Route-level auth guard. The proxy already blocks anonymous traffic, but every
 * handler checks again so a future matcher change cannot expose a write.
 */
export async function requireAdmin(): Promise<
  { session: AdminSession; response?: never } | { session?: never; response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { response: fail("unauthorized", "Sign in to continue.", 401) };
  }
  return { session };
}
