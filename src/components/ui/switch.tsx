import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "../../lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // The track fills when on: the state has to be visible without colour
      // vision, so it is also a position change on the thumb.
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border border-current " +
        "transition-colors data-[state=checked]:bg-current " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current " +
        "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 bg-current ring-0 transition-transform " +
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 " +
          "data-[state=checked]:mix-blend-difference"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
