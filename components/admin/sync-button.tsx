"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Report = {
  found: number;
  created: number;
  updated: number;
  unchanged: number;
  hidden: number;
  skippedOutsideArea: number;
  skippedCooldown?: boolean;
  durationMs: number;
};

export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(force: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/osm/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message ?? "Sync failed.");
      }
      const report = payload.data.report as Report;
      setMessage(
        report.skippedCooldown
          ? "Already synced within the last hour — try force if you really need it."
          : `Found ${report.found}: ${report.created} added, ${report.updated} updated, ${report.unchanged} unchanged, ${report.skippedOutsideArea} outside the area.`,
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(false)}>
          {busy ? "Syncing…" : "Sync OpenStreetMap"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(true)}>
          Force sync
        </button>
      </div>
      {message && <p className="text-sm text-muted">{message}</p>}
      {error && (
        <p role="alert" className="text-sm text-closed">
          {error}
        </p>
      )}
    </div>
  );
}
