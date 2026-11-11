import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

// STRUCTURE AND STATE ONLY. The variants differ in BORDER and LAYOUT, not in
// colour: this project's palette is yours to choose, so pass it in.
//   <Button className="bg-indigo-600 text-white rounded-full">Save</Button>
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-transparent",
        outline: "border border-current",
        ghost: "border border-transparent bg-transparent",
        link: "border-0 underline-offset-4 hover:underline",
      },
      // Sizes are HIT TARGETS, not a spacing system: a control smaller than
      // this is hard to tap. Override freely.
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a <button> (e.g. a router Link). */
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
