import { relative } from "path"

const cwd = process.cwd()

export const rel = (path: string) => {
  // For temp files, just show the filename
  if (path.includes("/var/folders/") || path.includes("/tmp/")) {
    return path.split("/").pop() || path
  }
  return relative(cwd, path) || path
}
