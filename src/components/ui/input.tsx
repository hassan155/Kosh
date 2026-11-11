import * as React from "react"

import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // A field with no edge is not a field. Everything else (background,
        // radius, type scale) is yours.
        "flex h-10 w-full border border-[color-mix(in_srgb,currentColor_18%,transparent)] bg-transparent px-3 py-2 " +
          "file:border-0 file:bg-transparent " +
          "placeholder:opacity-60 " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current " +
          "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
