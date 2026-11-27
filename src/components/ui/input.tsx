import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-[#2d261f] bg-[#0f0c0a] px-3 py-1 text-sm text-[#f7f3ec] shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#6e665c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4ba4a]/35 focus-visible:border-[#f4ba4a]/70 disabled:cursor-not-allowed disabled:bg-[#14110e] disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
