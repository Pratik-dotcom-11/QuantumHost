import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-xl border border-[#2d261f] bg-[#0f0c0a] px-3 py-1 text-sm text-[#f7f3ec] shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4ba4a]/35 focus-visible:border-[#f4ba4a]/70 disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

export { Select };
