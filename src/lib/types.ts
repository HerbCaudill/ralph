import { ExecSyncOptions } from "child_process"

export interface WorktreeInfo {
  path: string
  branch: string
  guid: string
}

export const execOptions: ExecSyncOptions = {
  stdio: "pipe",
  encoding: "utf-8",
}
