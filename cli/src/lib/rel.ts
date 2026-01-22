import { isAbsolute, relative } from "path"
import { getBaseCwd } from "./getBaseCwd.js"

/**
 * Convert an absolute path to a relative path from the base working directory.
 * For temp files, returns just the filename. Leaves relative paths unchanged.
 */
export const rel = (
  /** The path to convert */
  path: string,
) => {
  if (!isAbsolute(path)) {
    return path
  }
  // For temp files, just show the filename
  if (path.includes("/var/folders/") || path.includes("/tmp/")) {
    return path.split("/").pop() || path
  }
  return relative(getBaseCwd(), path) || path
}
