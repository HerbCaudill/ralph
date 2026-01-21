import { isAbsolute, relative } from "path"

const getBaseCwd = () => process.env.RALPH_CWD ?? process.cwd()

export const rel = (path: string) => {
  if (!isAbsolute(path)) {
    return path
  }
  // For temp files, just show the filename
  if (path.includes("/var/folders/") || path.includes("/tmp/")) {
    return path.split("/").pop() || path
  }
  return relative(getBaseCwd(), path) || path
}
