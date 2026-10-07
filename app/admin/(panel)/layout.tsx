import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "@/components/admin/logout-button";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="font-display text-lg font-semibold">
          Gentry <span className="text-gold">admin</span>
        </Link>
        <nav className="flex flex-wrap gap-2">
          <Link href="/admin" className="btn btn-ghost">
            Dashboard
          </Link>
          <Link href="/admin/shops/new" className="btn btn-secondary">
            New shop
          </Link>
          <Link href="/" className="btn btn-ghost">
            View site
          </Link>
          <LogoutButton />
        </nav>
      </div>
      {children}
    </div>
  );
}
