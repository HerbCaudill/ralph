import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Combine and merge Tailwind CSS class names, handling conflicts intelligently. */
export function cx(
  /** Variable number of class values to merge */
  ...inputs: ClassValue[]
): string {
  return twMerge(clsx(inputs))
}
