import { isAbsolute, relative } from "path"

/**
 * Get the base working directory for relative path calculations.
 * Respects RALPH_CWD environment variable if set, otherwise uses current working directory.
 */
const getBaseCwd = () => process.env.RALPH_CWD ?? process.cwd()

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
