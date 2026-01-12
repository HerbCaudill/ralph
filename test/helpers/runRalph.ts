import { spawn } from "child_process"
import { join } from "path"

export type RunRalphOptions = {
  args?: string[]
  cwd?: string
  timeout?: number
  env?: Record<string, string>
  input?: string // For providing stdin input (e.g., "y\n" for yes)
}

export type RunRalphResult = {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

/**
 * Runs the ralph binary for E2E testing
 */
export const runRalph = (options: RunRalphOptions = {}): Promise<RunRalphResult> => {
  const { args = [], cwd = process.cwd(), timeout = 5000, env = {}, input } = options

  return new Promise(resolve => {
    const ralphBin = join(__dirname, "../../bin/ralph.js")
    const child = spawn("node", [ralphBin, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: input ? "pipe" : "inherit",
    })

    let stdout = ""
    let stderr = ""
    let timedOut = false

    if (child.stdout) {
      child.stdout.on("data", data => {
        stdout += data.toString()
      })
    }

    if (child.stderr) {
      child.stderr.on("data", data => {
        stderr += data.toString()
      })
    }

    // Write input if provided
    if (input && child.stdin) {
      child.stdin.write(input)
      child.stdin.end()
    }

    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, timeout)

    child.on("close", exitCode => {
      clearTimeout(timer)
      resolve({ exitCode, stdout, stderr, timedOut })
    })

    child.on("error", error => {
      clearTimeout(timer)
      resolve({
        exitCode: null,
        stdout,
        stderr: stderr + error.message,
        timedOut,
      })
    })
  })
}
