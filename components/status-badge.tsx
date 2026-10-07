import type { StatusDto } from "@/lib/types";
import { cn } from "@/lib/utils";

const VARIANT: Record<StatusDto["state"], string> = {
  open: "badge-open",
  soon: "badge-soon",
  closed: "badge-closed",
  unknown: "badge-unknown",
};

/**
 * The status label is always present as text, so the colour is never the only
 * signal (WCAG 1.4.1).
 */
export function StatusBadge({
  status,
  className,
}: {
  status: StatusDto;
  className?: string;
}) {
  return (
    <span
      className={cn("badge", VARIANT[status.state], className)}
      title={status.state === "unknown" ? "No hours listed for this shop" : status.label}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.label}
    </span>
  );
}
