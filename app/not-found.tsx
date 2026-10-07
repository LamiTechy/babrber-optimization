import Link from "next/link";
import { SITE_NAME } from "@/lib/config";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-20 text-center">
      <p className="font-display text-5xl font-semibold text-gold">404</p>
      <h1 className="font-display text-2xl font-semibold">That page is not here</h1>
      <p className="max-w-md text-sm text-muted">
        The shop may have moved, or the link may be wrong. Try searching again from {SITE_NAME}.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary">
          Back to home
        </Link>
        <Link href="/results" className="btn btn-ghost">
          Find a barber
        </Link>
      </div>
    </div>
  );
}
