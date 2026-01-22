import os from "node:os"
import path from "node:path"

/**
 * Get the path to the global beads registry file.
 */
export function getRegistryPath(): string {
  return path.join(os.homedir(), ".beads", "registry.json")
}
