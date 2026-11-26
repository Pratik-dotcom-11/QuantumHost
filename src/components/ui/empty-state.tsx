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
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#1d5bff]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-[#0b0f19]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[#525b6c]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
