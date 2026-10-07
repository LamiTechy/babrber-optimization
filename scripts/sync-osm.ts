import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { closeDb } from "@/lib/db";
import { runOsmImport } from "@/lib/osm/importShops";

loadEnv({ path: ".env.local" });
loadEnv();

/**
 * One-off OpenStreetMap import: `npm run sync:osm [-- --force]`.
 * `--force` skips the one-per-hour cooldown (useful right after a manual test).
 */
async function main() {
  const force = process.argv.includes("--force");
  const report = await runOsmImport({ force });

  console.log(report.message);
  console.log(
    JSON.stringify(
      {
        ranAt: report.ranAt,
        found: report.found,
        created: report.created,
        updated: report.updated,
        unchanged: report.unchanged,
        hidden: report.hidden,
        skippedOutsideArea: report.skippedOutsideArea,
        skippedCooldown: report.skippedCooldown,
        durationMs: report.durationMs,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Sync failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
