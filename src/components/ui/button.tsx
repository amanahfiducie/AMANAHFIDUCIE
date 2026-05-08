import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg text-xs sm:text-sm font-semibold tracking-[0.01em] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-3.5 sm:[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform group-hover/btn:[&_svg]:translate-x-0.5 active:translate-y-px active:scale-[0.99] overflow-hidden group/btn touch-manipulation select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-card hover:bg-primary/92 hover:shadow-elegant hover:-translate-y-0.5 before:absolute before:inset-0 before:opacity-0 before:bg-gradient-to-r before:from-transparent before:via-primary-foreground/15 before:to-transparent before:transition-opacity hover:before:opacity-100",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/92 hover:shadow-card hover:-translate-y-0.5",
        outline:
          "border border-primary/35 bg-background/70 text-foreground shadow-sm backdrop-blur-sm hover:border-primary hover:bg-accent hover:text-accent-foreground hover:shadow-card hover:-translate-y-0.5",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/85 hover:shadow-card hover:-translate-y-0.5",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:shadow-sm",
        link: "text-primary underline-offset-4 hover:underline",
        hero:
          "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--gold)_92%,white)_0%,color-mix(in_oklab,var(--gold)_75%,var(--primary)_25%)_100%)] text-primary shadow-gold font-semibold tracking-wide border border-gold/40 hover:shadow-elegant hover:-translate-y-0.5 hover:saturate-125 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full",
        heroOutline:
          "border border-gold/70 text-primary-foreground bg-primary/30 backdrop-blur-sm hover:bg-gold/15 hover:border-gold hover:text-gold hover:shadow-card hover:-translate-y-0.5",
        gold:
          "bg-gold text-gold-foreground shadow-gold font-medium hover:bg-gold/92 hover:shadow-elegant hover:-translate-y-0.5",
      },
      size: {
        default: "h-9 px-3.5 py-2 sm:h-10 sm:px-5 sm:py-2.5",
        sm: "h-7 rounded-md px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs",
        lg: "h-9 px-4 text-xs sm:h-12 sm:px-8 sm:text-base",
        xl: "h-10 px-5 text-xs tracking-wide sm:h-14 sm:px-10 sm:text-base",
        icon: "size-9 sm:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
