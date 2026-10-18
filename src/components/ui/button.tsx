import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:border disabled:border-dashed disabled:border-input disabled:bg-transparent disabled:text-muted-foreground active:translate-y-px",
  {
    variants: {
      variant: {
        // 08-site: Monolith pills. Primary is the ink pill (--primary maps to --ink in the app).
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        // The red is for errors only, so a destructive action is a red OUTLINE, never a red
        // call-to-action fill (founder decision, 08-site phase 1).
        destructive:
          "border border-destructive bg-transparent text-destructive hover:bg-secondary",
        // Secondary/outline: white with a crisp border — reads as a real action, not a
        // ghost, without competing with primary.
        outline:
          "border border-input bg-transparent hover:border-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
