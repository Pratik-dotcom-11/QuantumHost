import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2e271f] bg-[#120f0c] px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#d49b4b]/30 bg-[#2a1d0e]/60 text-[#f4ba4a]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-[#f7f3ec]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[#9a9084]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
