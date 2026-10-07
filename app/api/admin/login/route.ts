import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { fail, fromZodError, isZodError, ok, serverError } from "@/lib/api/response";
import { ADMIN_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";
import { getDb } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loginSchema } from "@/lib/validation/admin";

/** Per-IP attempt counter so a bot cannot grind the admin password. */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

/** Same cost as a real comparison so a missing account is not detectable. */
let dummyHash: Promise<string> | null = null;

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(clientKey(request))) {
      return fail("rate_limited", "Too many attempts. Try again in a few minutes.", 429);
    }

    const payload = await request.json();
    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) return fromZodError(parsed.error, 422);

    const db = await getDb();
    const email = parsed.data.email.toLowerCase();
    const [admin] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);

    dummyHash ??= bcrypt.hash("gentry-dummy-password", 10);
    const valid = await bcrypt.compare(parsed.data.password, admin?.passwordHash ?? (await dummyHash));

    if (!admin || !valid) {
      return fail("invalid_credentials", "Email or password is incorrect.", 401);
    }

    const token = await createSessionToken({ sub: admin.id, email: admin.email });
    const response = ok({ email: admin.email });
    response.cookies.set(ADMIN_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (isZodError(error)) return fromZodError(error, 422);
    return serverError(error, "Could not sign you in.");
  }
}
