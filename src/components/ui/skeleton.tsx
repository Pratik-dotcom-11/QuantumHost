import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "qh-skeleton-shimmer rounded-2xl border border-[#221c16]",
        className
      )}
      aria-hidden="true"
    />
  );
}
