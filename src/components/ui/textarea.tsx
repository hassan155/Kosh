import * as React from "react"

import { cn } from "../../lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full border border-[color-mix(in_srgb,currentColor_18%,transparent)] bg-transparent px-3 py-2 " +
        "placeholder:opacity-60 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current " +
        "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export { Textarea }
