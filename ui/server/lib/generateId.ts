import { randomBytes } from "node:crypto"

/**
 * Generate a short, URL-safe ID (8 chars).
 */
export function generateId(): string {
  return randomBytes(4).toString("hex")
}
