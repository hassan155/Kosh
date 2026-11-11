import { clsx } from "clsx"
import type { ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge class names, with LATER classes winning conflicts.
 *
 * This is what makes the ui/ primitives restyleable: they carry structural
 * defaults, and any Tailwind class you pass in `className` replaces the
 * default in the same group rather than fighting it in the stylesheet.
 *
 *   cn("h-10 px-4", "px-8")        -> "h-10 px-8"
 *   cn("border", isActive && "border-2")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
