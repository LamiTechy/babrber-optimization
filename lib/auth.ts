import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  verifySessionToken,
  type AdminSession,
} from "@/lib/session";

export * from "@/lib/session";

/** Server-side session lookup (route handlers and server components). */
export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}
