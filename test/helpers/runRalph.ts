import { execa } from "execa"
import { join } from "path"
import { writeFileSync, mkdirSync, existsSync } from "fs"

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
 * Runs the ralph binary for E2E testing and saves output to .test-results
 */
export const runRalph = async (options: RunRalphOptions = {}): Promise<RunRalphResult> => {
  const { args = [], cwd = process.cwd(), timeout = 5000, env = {}, input, testName } = options

  const ralphBin = join(__dirname, "../../bin/ralph.js")

  let result: Awaited<ReturnType<typeof execa>>
  let timedOut = false

  try {
    result = await execa("node", [ralphBin, ...args], {
      cwd,
      env: { ...process.env, ...env, CI: "true" }, // Force non-TTY mode
      input,
      timeout,
      reject: false, // Don't throw on non-zero exit
      all: true, // Combine stdout and stderr
    })
  } catch (error: unknown) {
    // Handle timeout
    if (error && typeof error === "object" && "timedOut" in error) {
      timedOut = true
      result = error as Awaited<ReturnType<typeof execa>>
    } else {
      throw error
    }
  }

  const exitCode = result.exitCode ?? -1
  const stdout = result.stdout ?? ""
  const stderr = result.stderr ?? ""

  // Save output to file if testName provided
  let outputFile: string | undefined
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

    const output = `
=== Ralph E2E Test Output ===
Test: ${testName}
Args: ${args.join(" ")}
CWD: ${cwd}
Exit Code: ${exitCode}
Timed Out: ${timedOut}
Timestamp: ${new Date().toISOString()}

=== STDOUT ===
${stdout}

=== STDERR ===
${stderr}

=== COMBINED OUTPUT ===
${result.all ?? ""}
`.trim()

    writeFileSync(outputFile, output, "utf-8")
  }

  return {
    exitCode,
    stdout,
    stderr,
    timedOut,
    outputFile,
  }
}
