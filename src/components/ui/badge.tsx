import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[-0.01em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#d49b4b]/35 bg-[#2a1d0e]/70 text-[#f5ca73]",
        violet: "border-[#f7f3ec]/20 bg-[#f7f3ec]/10 text-[#f7f3ec]",
        success: "border-emerald-500/30 bg-emerald-500/12 text-emerald-300",
        warning: "border-amber-500/35 bg-amber-500/12 text-amber-300",
        destructive: "border-rose-500/35 bg-rose-500/12 text-rose-300",
        secondary: "border-[#2a231c] bg-[#1c1713] text-[#a89e91]",
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
