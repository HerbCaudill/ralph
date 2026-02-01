import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Combine and merge Tailwind class names. */
export function cn(
  /** Class values to merge. */
  ...inputs: ClassValue[]
): string {
  return twMerge(clsx(inputs))
}
