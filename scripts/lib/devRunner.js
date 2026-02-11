/**
 * Declarative dev launcher with port discovery, service orchestration, and cleanup.
 *
 * Provides shared utilities for finding available ports, waiting for services,
 * and running multi-service dev environments. Used by dev.js, dev-split.js,
 * and playwright.js.
 */
import getPort, { portNumbers } from "get-port"
import { execSync, spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"

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

  // Run pre-build commands sequentially (topological dependency order)
  if (preBuild.length > 0) {
    console.log(`[${label}] Building dependencies...`)
    for (const cmd of preBuild) {
      console.log(`[${label}]   $ ${cmd}`)
      execSync(cmd, { stdio: "inherit" })
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

  // Start services. Pipe stderr so we can suppress pnpm's noisy error
  // messages during shutdown (they report SIGINT/SIGTERM as failures).
  const processes = []
  for (const svc of services) {
    const [cmd, ...args] = svc.command.split(" ")
    const svcEnv = { ...baseEnv, ...(svc.env || {}) }
    const proc = spawn(cmd, args, {
      stdio: ["ignore", "inherit", "pipe"],
      env: svcEnv,
      detached: true,
    })
    proc.stderr.pipe(process.stderr)
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
    const frontendEnv = { ...baseEnv, ...(frontend.env || {}) }
    const proc = spawn("pnpm", uiArgs, {
      stdio: ["ignore", "inherit", "pipe"],
      env: frontendEnv,
      detached: true,
    })
    proc.stderr.pipe(process.stderr)
    processes.push({ name: "frontend", proc })
  }

  // Cleanup function
  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    // Disconnect stderr pipes first so pnpm's shutdown error messages
    // (e.g. "Command failed with signal SIGINT") are discarded.
    for (const { proc } of processes) {
      if (proc.stderr) {
        proc.stderr.unpipe(process.stderr)
        proc.stderr.destroy()
      }
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
