"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SITE_NAME } from "@/lib/config";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message ?? "Could not sign you in.");
      }
      const next = params.get("from");
      router.replace(next && next.startsWith("/") ? next : "/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign you in.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">{SITE_NAME} admin</h1>
        <p className="text-sm text-muted">Sign in to edit shops, hours and prices.</p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          type="email"
          required
          autoComplete="username"
          className="field"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          className="field"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-closed-soft px-3 py-2 text-sm text-closed">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
