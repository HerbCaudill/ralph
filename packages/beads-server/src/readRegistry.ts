import fs from "node:fs"
import { getRegistryPath } from "./getRegistryPath.js"
import { type RegistryEntry } from "./types.js"

/**
 * Read and parse the registry file.
 * Returns an array of registry entries, or empty array if file doesn't exist or is invalid.
 */
export function readRegistry(): RegistryEntry[] {
  const registryPath = getRegistryPath()
  try {
    const content = fs.readFileSync(registryPath, "utf8")
    const data = JSON.parse(content) as unknown
    if (Array.isArray(data)) {
      return data as RegistryEntry[]
    }
    return []
  } catch {
    return []
  }
}
