/**
 * Declarative dev launcher with port discovery, service orchestration, and cleanup.
 *
 * Provides shared utilities for finding available ports, waiting for services,
 * and running multi-service dev environments. Used by dev.js, dev-split.js,
 * and playwright.js.
 */
import getPort, { portNumbers } from "get-port"
import { execSync, spawn } from "node:child_process"
import { Transform } from "node:stream"
import { setTimeout as delay } from "node:timers/promises"

// Many child processes pipe to the same stdout/stderr; raise the listener
// limit to avoid false-positive EventEmitter leak warnings.
process.stdout.setMaxListeners(30)
process.stderr.setMaxListeners(30)

/** Escape sequences tsc --watch uses to clear the screen. */
const CLEAR_SCREEN_CODES = /\x1Bc|\x1B\[2J\x1B\[H|\x1B\[2J|\x1B\[H/g

/** ANSI escape codes (colors, bold, dim, etc.). */
const ANSI_CODES = /\x1B\[[0-9;]*[a-zA-Z]/g

/** Pnpm script runner banner/echo lines (e.g. "> @herbcaudill/ralph@1.2.0 dev" or "> tsx --watch src/main.ts"). */
const PNPM_BANNER = /^> /

/** Vite noise patterns — matched lines are dropped in "quiet" mode. */
const VITE_NOISE = [
  /VITE v\d/, // banner
  /Local:\s+http/, // local URL (redundant with devRunner port log)
  /Network:/, // network URL
  /press h/, // help hint
  /hmr update/i, // HMR update
  /page reload/i, // page reload
  /connected\./i, // WebSocket connected
]

/** Dim ANSI escape wrapper. */
const dim = (/** @type {string} */ s) => `\x1B[2m${s}\x1B[22m`

/**
 * Create a transform stream that filters noisy output from child processes.
 *
 * Modes:
 * - `"all"` — Strip pnpm banners, clear-screen codes, blank lines. Pass everything else. (servers)
 * - `"errors"` — Only pass tsc error blocks and "Found N errors" (N>0). Prefix with dim [name]. (tsc watchers)
 * - `"quiet"` — Drop known Vite noise. Pass everything else (errors, warnings). (frontend)
 */
function createOutputFilter(
  /** Filter mode: "all" | "errors" | "quiet" */
  mode = "all",
  /** Process name, used as prefix in "errors" mode */
  name = "",
) {
  let buffer = ""
  let lastLineWasBlank = true // Start true to suppress leading blank lines
  /** Whether we're inside a tsc error section (from first error to "Found N errors") */
  let inErrorSection = false
  const prefix = name ? dim(`[${name}]`) + " " : ""

  return new Transform({
    transform(chunk, _encoding, callback) {
      buffer += chunk.toString().replace(CLEAR_SCREEN_CODES, "")
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const shouldEmit = filterLine(line, mode, { inErrorSection })

        // Update error section state machine for "errors" mode.
        // An error section spans from the first `- error TS` line to the `Found N errors` line.
        if (mode === "errors") {
          const plain = line.replace(ANSI_CODES, "")
          if (!inErrorSection && /error TS\d+/.test(plain)) {
            inErrorSection = true
          } else if (inErrorSection && /Found \d+ error/.test(plain)) {
            inErrorSection = false
          }
        }

        if (!shouldEmit) continue

        if (mode === "errors") {
          // Skip blank lines even within error sections
          if (line.replace(ANSI_CODES, "").trim() !== "") {
            this.push(prefix + line + "\n")
          }
        } else {
          const isBlank = line.trim() === ""
          if (isBlank) {
            lastLineWasBlank = true
            continue
          }
          if (lastLineWasBlank) this.push("\n")
          lastLineWasBlank = false
          this.push(line + "\n")
        }
      }
      callback()
    },
    flush(callback) {
      if (buffer && buffer.trim() !== "") {
        const shouldEmit = filterLine(buffer, mode, { inErrorSection })
        if (shouldEmit) {
          if (mode === "errors") {
            this.push(prefix + buffer)
          } else {
            this.push(buffer)
          }
        }
      }
      callback()
    },
  })
}

/**
 * Decide whether a line should be emitted based on the filter mode.
 * Returns true if the line should pass through.
 */
function filterLine(
  /** The line to evaluate */
  line,
  /** Filter mode */
  mode,
  /** State context for the errors mode state machine */
  { inErrorSection = false } = {},
) {
  // Strip ANSI codes for pattern matching
  const plain = line.replace(ANSI_CODES, "")

  // All modes strip pnpm banners
  if (PNPM_BANNER.test(plain)) return false

  if (mode === "all") {
    // Pass everything except pnpm banners and blank lines (handled by caller)
    return true
  }

  if (mode === "errors") {
    // Error section: emit everything from first `- error TS` to `Found N errors` (N>0).
    if (/error TS\d+/.test(plain)) return true
    if (inErrorSection) return true
    const foundMatch = plain.match(/Found (\d+) error/)
    if (foundMatch && Number(foundMatch[1]) > 0) return true
    return false
  }

  if (mode === "quiet") {
    // Drop Vite noise, pass everything else
    if (VITE_NOISE.some(re => re.test(plain))) return false
    return true
  }

  return true
}

const MAX_PORT_ATTEMPTS = 10
const DEFAULT_WAIT_TIMEOUT_MS = 30_000
const DEFAULT_WAIT_INTERVAL_MS = 250

/** Check whether a port is available on localhost. */
export async function checkPortAvailable(
  /** The port number to check */
  port,
) {
  const available = await getPort({ port })
  return available === port
}

/**
 * Find the first available port starting from `startPort`, trying up to
 * `MAX_PORT_ATTEMPTS` consecutive ports.
 */
export async function findAvailablePort(
  /** The port to start searching from */
  startPort,
) {
  return getPort({ port: portNumbers(startPort, startPort + MAX_PORT_ATTEMPTS - 1) })
}

/**
 * Resolve a port from an environment variable, falling back to finding an
 * available port starting from `defaultPort`. Throws if the env-specified
 * port is already in use.
 */
export async function resolvePort(
  /** Environment variable name to read the port from */
  envVar,
  /** Default port to start searching from */
  defaultPort,
  /** Human-readable name for error messages */
  name,
) {
  const requested = process.env[envVar] ? Number(process.env[envVar]) : undefined
  if (requested !== undefined) {
    if (!(await checkPortAvailable(requested))) {
      throw new Error(`${name} port ${requested} (from ${envVar}) is already in use`)
    }
    return requested
  }
  return findAvailablePort(defaultPort)
}

/**
 * Poll a URL until it returns a successful response, or throw after a timeout.
 */
export async function waitForUrl(
  /** The URL to poll */
  url,
  /** Maximum time to wait in milliseconds */
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
  /** Interval between retries in milliseconds */
  intervalMs = DEFAULT_WAIT_INTERVAL_MS,
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Keep retrying until timeout.
    }
    await delay(intervalMs)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

/**
 * Declarative dev environment runner. Starts backend services, optionally
 * waits for health checks, then starts a Vite frontend. Returns handles
 * for cleanup and port information.
 *
 * Config shape:
 * ```
 * {
 *   label: "dev",
 *   preBuild: [
 *     // Commands run sequentially before services start (topological build order)
 *     "pnpm --filter components --filter agent-view-theme build",
 *     "pnpm --filter agent-view build",
 *   ],
 *   services: [
 *     // Server with port and health check
 *     { name: "server", command: "pnpm serve", portEnv: "PORT", defaultPort: 4242 },
 *     // Watcher without port (e.g., tsc --watch)
 *     { name: "components", command: "pnpm --filter pkg dev" },
 *   ],
 *   frontend: {
 *     package: "@herbcaudill/ralph-ui",
 *     portEnv: "RALPH_UI_PORT",
 *     defaultPort: 5179,
 *     open: true,
 *     extraArgs: [],
 *   },
 *   env: {},
 *   waitForHealthz: false,
 * }
 * ```
 */
export async function runDev(
  /** Configuration object (see above) */
  config,
) {
  const {
    label = "dev",
    preBuild = [],
    services = [],
    frontend,
    env: extraEnv = {},
    waitForHealthz = false,
  } = config

  // Run pre-build commands sequentially (topological dependency order).
  // Output is captured and only shown on failure.
  if (preBuild.length > 0) {
    console.log(`[${label}] Building dependencies...`)
    for (const cmd of preBuild) {
      console.log(`[${label}]   $ ${cmd}`)
      try {
        execSync(cmd, { stdio: "pipe" })
      } catch (err) {
        const output = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "")
        if (output) process.stderr.write(output)
        throw err
      }
    }
    console.log(`[${label}] Dependencies built.`)
  }

  // Resolve all ports (only for services that have ports)
  const ports = {}
  for (const svc of services) {
    if (svc.portEnv && svc.defaultPort) {
      ports[svc.name] = await resolvePort(svc.portEnv, svc.defaultPort, svc.name)
    }
  }
  if (frontend) {
    ports._frontend = await resolvePort(frontend.portEnv, frontend.defaultPort, "frontend")
  }

  // Build env with resolved ports
  const baseEnv = { ...process.env, ...extraEnv }
  for (const svc of services) {
    if (svc.portEnv && ports[svc.name]) {
      baseEnv[svc.portEnv] = String(ports[svc.name])
    }
  }
  if (frontend) {
    baseEnv[frontend.portEnv] = String(ports._frontend)
  }

  // Log ports and services
  for (const svc of services) {
    if (ports[svc.name]) {
      console.log(`[${label}] ${svc.name} → http://localhost:${ports[svc.name]}`)
    } else {
      console.log(`[${label}] ${svc.name} (watcher)`)
    }
  }
  if (frontend) {
    console.log(`[${label}] frontend → http://localhost:${ports._frontend}`)
  }

  // Start services. Pipe stdout/stderr so we can disconnect them during
  // shutdown to suppress pnpm's noisy "Command failed with signal" messages.
  // FORCE_COLOR preserves colored output despite the piped stdio.
  const processes = []
  for (const svc of services) {
    const [cmd, ...args] = svc.command.split(" ")
    const svcEnv = { ...baseEnv, FORCE_COLOR: "1", ...(svc.env || {}) }
    const proc = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: svcEnv,
      detached: true,
    })
    const mode = svc.portEnv ? "all" : "errors"
    proc.stdout.pipe(createOutputFilter(mode, svc.name)).pipe(process.stdout)
    proc.stderr.pipe(createOutputFilter(mode, svc.name)).pipe(process.stderr)
    processes.push({ name: svc.name, proc })
  }

  // Wait for health checks if requested (only for services with ports)
  if (waitForHealthz) {
    for (const svc of services) {
      if (!ports[svc.name]) continue // Skip watchers without ports
      if (svc.healthUrl) {
        const url = svc.healthUrl.replace("${port}", String(ports[svc.name]))
        await waitForUrl(url)
      } else {
        await waitForUrl(`http://localhost:${ports[svc.name]}/healthz`)
      }
    }
  } else if (services.length > 0 && frontend) {
    // Give servers a moment to start
    const startupDelay = services.length > 1 ? 1500 : 1000
    await delay(startupDelay)
  }

  // Start frontend
  if (frontend) {
    const uiArgs = ["--filter", frontend.package, "exec", "vite", "--port", String(ports._frontend)]
    if (frontend.open && !process.env.RALPH_NO_OPEN) {
      uiArgs.push("--open")
    }
    if (frontend.extraArgs) {
      uiArgs.push(...frontend.extraArgs)
    }
    const frontendEnv = { ...baseEnv, FORCE_COLOR: "1", ...(frontend.env || {}) }
    const proc = spawn("pnpm", uiArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: frontendEnv,
      detached: true,
    })
    proc.stdout.pipe(createOutputFilter("quiet", "frontend")).pipe(process.stdout)
    proc.stderr.pipe(createOutputFilter("quiet", "frontend")).pipe(process.stderr)
    processes.push({ name: "frontend", proc })
  }

  // Cleanup function
  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    // Disconnect output pipes first so pnpm's shutdown error messages
    // (e.g. "Command failed with signal SIGTERM") are discarded.
    for (const { proc } of processes) {
      proc.stdout?.unpipe(process.stdout)
      proc.stdout?.destroy()
      proc.stderr?.unpipe(process.stderr)
      proc.stderr?.destroy()
    }
    for (const { proc } of processes) {
      try {
        process.kill(-proc.pid, "SIGTERM")
      } catch {
        // Process may have already exited.
      }
    }
  }

  // Wire up signal handlers if running as main script (not imported for programmatic use)
  if (config._attachSignalHandlers !== false) {
    process.on("SIGINT", () => {
      cleanup()
      process.exit()
    })
    process.on("SIGTERM", () => {
      cleanup()
      process.exit()
    })

    // Exit if any process exits
    for (const { name, proc } of processes) {
      proc.on("exit", code => {
        console.log(`[${label}] ${name} exited with code ${code}`)
        cleanup()
        process.exit(code ?? 1)
      })
    }
  }

  return { ports, cleanup, processes }
}
