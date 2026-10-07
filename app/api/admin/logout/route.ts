import { ok } from "@/lib/api/response";
import { ADMIN_COOKIE } from "@/lib/session";

export async function POST() {
  const response = ok({ signedOut: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  return response;
}
