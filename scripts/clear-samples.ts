import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";
import { closeDb, getDb, schema } from "@/lib/db";

loadEnv({ path: ".env.local" });
loadEnv();

/**
 * Wipes the demo sample shops before launch: `npm run db:clear-samples`.
 * Add `--with-landmarks` to also drop the placeholder landmark list.
 */
async function main() {
  const db = await getDb();
  const withLandmarks = process.argv.includes("--with-landmarks");

  const deletedShops = await db
    .delete(schema.shops)
    .where(eq(schema.shops.source, "sample"))
    .returning({ slug: schema.shops.slug });
  console.log(`Removed ${deletedShops.length} sample shop(s).`);

  if (withLandmarks) {
    const deletedLandmarks = await db.delete(schema.landmarks).returning({
      name: schema.landmarks.name,
    });
    console.log(`Removed ${deletedLandmarks.length} placeholder landmark(s).`);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error("Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
