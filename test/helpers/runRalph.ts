import { spawn } from "child_process"
import { join } from "path"
import { createWriteStream, mkdirSync, existsSync } from "fs"

export type RunRalphOptions = {
  args?: string[]
  cwd?: string
  timeout?: number
  env?: Record<string, string>
  input?: string // For providing stdin input (e.g., "y\n" for yes)
  testName?: string // Optional test name for saving output
}

export type RunRalphResult = {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
  outputFile?: string // Path to saved output file
}

/**
 * Runs the ralph binary for E2E testing and streams output to .test-results
 */
export const runRalph = async (options: RunRalphOptions = {}): Promise<RunRalphResult> => {
  const { args = [], cwd = process.cwd(), timeout = 5000, env = {}, input, testName } = options

  const ralphBin = join(__dirname, "../../bin/ralph.js")

  return new Promise((resolve, reject) => {
    let outputFile: string | undefined
    let fileStream: ReturnType<typeof createWriteStream> | undefined

    // Set up output file if testName provided
    if (testName) {
      const resultsDir = join(__dirname, "../../.test-results")
      if (!existsSync(resultsDir)) {
        mkdirSync(resultsDir, { recursive: true })
      }

      // Sanitize test name for filename
      const safeTestName = testName.replace(/[^a-z0-9]/gi, "-").toLowerCase()
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const filename = `${safeTestName}-${timestamp}.txt`
      outputFile = join(resultsDir, filename)

      fileStream = createWriteStream(outputFile, { flags: "w" })

      // Write header
      fileStream.write(`=== Ralph E2E Test Output ===
Test: ${testName}
Args: ${args.join(" ")}
CWD: ${cwd}
Started: ${new Date().toISOString()}

=== STREAMING OUTPUT ===

`)
    }

    const proc = spawn("node", [ralphBin, ...args], {
      cwd,
      env: { ...process.env, ...env, CI: "true" }, // Force non-TTY mode
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    let timedOut = false
    let timeoutHandle: NodeJS.Timeout | undefined

    // Set up timeout
    if (timeout) {
      timeoutHandle = setTimeout(() => {
        timedOut = true
        proc.kill("SIGTERM")
      }, timeout)
    }

    // Capture and stream stdout
    proc.stdout?.on("data", (data: Buffer) => {
      const text = data.toString()
      stdout += text
      fileStream?.write(text)
    })

    // Capture and stream stderr
    proc.stderr?.on("data", (data: Buffer) => {
      const text = data.toString()
      stderr += text
      fileStream?.write(`[STDERR] ${text}`)
    })

    // Handle stdin input
    if (input && proc.stdin) {
      proc.stdin.write(input)
      proc.stdin.end()
    }

    // Handle process exit
    proc.on("close", code => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }

      const exitCode = code ?? -1

      // Write footer to file
      if (fileStream) {
        fileStream.write(`

=== TEST COMPLETE ===
Exit Code: ${exitCode}
Timed Out: ${timedOut}
Finished: ${new Date().toISOString()}
`)
        fileStream.end()
      }

      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
        outputFile,
      })
    })

    proc.on("error", error => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
      fileStream?.end()
      reject(error)
    })
  })
}
