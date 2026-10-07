import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isProduction } from "@/lib/env";
import * as schema from "./schema";

/**
 * Database access.
 *
 * - Production / Neon: `DATABASE_URL` (postgres.js over TLS or the pooled
 *   Neon endpoint).
 * - Local development without a Neon account: an embedded PGlite (Postgres in
 *   a WASM process) stored in `.data/gentry`, migrated from `drizzle/*.sql`.
 *
 * The public site only ever reads; admin routes write. Nothing here trusts
 * client input — every value is validated by Zod before it reaches these calls.
 *
 * The handle lives on `globalThis` because the dev server gives each route its
 * own module instance — two PGlite processes on one data directory abort each
 * other.
 */

export type Database = PostgresJsDatabase<typeof schema>;

type DbState = {
  pgClient: ReturnType<typeof postgres> | null;
  db: Database | null;
  opening: Promise<Database> | null;
};

const STATE_KEY = Symbol.for("gentry.db.state");

function state(): DbState {
  const holder = globalThis as typeof globalThis & { [STATE_KEY]?: DbState };
  holder[STATE_KEY] ??= { pgClient: null, db: null, opening: null };
  return holder[STATE_KEY];
}

async function applyEmbeddedMigrations(client: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  exec: (sql: string) => Promise<unknown>;
}): Promise<void> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const dir = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(dir)) return;

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  // Local databases are disposable: track which files have run so new
  // migrations apply to an existing `.data/gentry`.
  await client.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const applied = await client.query("select name from schema_migrations");
  const appliedNames = new Set(applied.rows.map((row) => String(row.name)));

  for (const file of files) {
    if (appliedNames.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await client.exec(sql);
    await client.query("insert into schema_migrations(name) values ($1)", [file]);
    console.log(`[db] applied embedded migration ${file}`);
  }
}

async function openEmbeddedDb(): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleEmbedded } = await import("drizzle-orm/pglite");
  const fs = await import("node:fs");
  const path = await import("node:path");

  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "gentry");
  fs.mkdirSync(dir, { recursive: true });

  const client = new PGlite(dir);
  await applyEmbeddedMigrations(client);

  console.log(`[db] using embedded PGlite database at ${dir} (set DATABASE_URL to use Neon)`);
  return drizzleEmbedded(client, { schema }) as unknown as Database;
}

/** Returns a shared connection, opening (and migrating) it on first use. */
export async function getDb(): Promise<Database> {
  const current = state();
  if (current.db) return current.db;
  if (current.opening) return current.opening;

  const url = process.env.DATABASE_URL;

  if (!url) {
    // Production on Vercel always has DATABASE_URL; ALLOW_EMBEDDED_DB lets a
    // local production build (`next build`) run against the embedded database.
    if (isProduction() && process.env.ALLOW_EMBEDDED_DB !== "true") {
      throw new Error(
        "DATABASE_URL is not set. Add your Neon connection string (see .env.example).",
      );
    }
    current.opening = openEmbeddedDb()
      .then((database) => {
        current.db = database;
        return database;
      })
      .finally(() => {
        current.opening = null;
      });
    return current.opening;
  }

  current.opening = Promise.resolve().then(() => {
    current.pgClient = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      // Neon's pooled endpoint multiplexes connections for us.
      prepare: false,
    });
    current.db = drizzle(current.pgClient, { schema });
    return current.db;
  });

  try {
    return await current.opening;
  } finally {
    current.opening = null;
  }
}

export async function closeDb(): Promise<void> {
  const current = state();
  if (current.pgClient) {
    await current.pgClient.end({ timeout: 5 });
    current.pgClient = null;
  }
  current.db = null;
}

export { schema };
