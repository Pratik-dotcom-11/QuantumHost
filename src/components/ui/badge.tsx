import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[-0.01em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#dbe5ff] bg-[#eef3ff] text-[#1d5bff]",
        violet: "border-[#0a0e17] bg-[#0a0e17] text-white",
        success: "border-emerald-200/80 bg-emerald-50/80 text-emerald-700",
        warning: "border-amber-200/80 bg-amber-50/80 text-amber-700",
        destructive: "border-rose-200/80 bg-rose-50/80 text-rose-700",
        secondary: "border-[#e5e8ef] bg-[#f3f5f8] text-[#556070]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
