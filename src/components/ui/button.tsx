import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[13px] font-medium tracking-[-0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4ba4a]/45 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#f4ba4a] text-[#110d08] hover:bg-[#f7c86b] shadow-[0_0_24px_rgba(244,186,74,0.18)]",
        light:
          "bg-[#f7f3ec] text-[#0b0907] hover:bg-white shadow-xs",
        dark:
          "border border-[#2d261f] bg-[#181410] text-[#f7f3ec] hover:bg-[#231d17] hover:border-[#3e342a]",
        destructive:
          "border border-rose-500/35 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25",
        outline:
          "border border-[#3a2f22] bg-[#16120e]/80 text-[#f2ece2] hover:bg-[#221b14] hover:border-[#d49b4b]/55",
        secondary:
          "border border-[#26201a] bg-[#1d1813] text-[#f2ece2] hover:bg-[#28211a]",
        ghost: "text-[#9a9084] hover:bg-[#1b1612] hover:text-[#f7f3ec]",
        link: "text-[#f4ba4a] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-5 py-2",
        sm: "h-8 px-4 text-xs",
        lg: "h-11 px-6 text-sm",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
