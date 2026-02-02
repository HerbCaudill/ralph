/**
 * Declarative dev launcher with port discovery, service orchestration, and cleanup.
 *
 * Provides shared utilities for finding available ports, waiting for services,
 * and running multi-service dev environments. Used by dev.js, dev-split.js,
 * and playwright.js.
 */
import getPort, { portNumbers } from "get-port"
import { spawn } from "node:child_process"
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
 *   services: [
 *     { name: "server", command: "pnpm serve", portEnv: "PORT", defaultPort: 4242 },
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
 *   stdio: "inherit",
 * }
 * ```
 */
export async function runDev(
  /** Configuration object (see above) */
  config,
) {
  const {
    label = "dev",
    services = [],
    frontend,
    env: extraEnv = {},
    waitForHealthz = false,
    stdio = "inherit",
  } = config

  // Resolve all ports
  const ports = {}
  for (const svc of services) {
    ports[svc.name] = await resolvePort(svc.portEnv, svc.defaultPort, svc.name)
  }
  if (frontend) {
    ports._frontend = await resolvePort(frontend.portEnv, frontend.defaultPort, "frontend")
  }

  // Build env with resolved ports
  const baseEnv = { ...process.env, ...extraEnv }
  for (const svc of services) {
    baseEnv[svc.portEnv] = String(ports[svc.name])
  }
  if (frontend) {
    baseEnv[frontend.portEnv] = String(ports._frontend)
  }

  // Log ports
  for (const svc of services) {
    console.log(`[${label}] ${svc.name} → http://localhost:${ports[svc.name]}`)
  }
  if (frontend) {
    console.log(`[${label}] frontend → http://localhost:${ports._frontend}`)
  }

  // Start services
  const processes = []
  for (const svc of services) {
    const [cmd, ...args] = svc.command.split(" ")
    const svcEnv = { ...baseEnv, ...(svc.env || {}) }
    const proc = spawn(cmd, args, { stdio, env: svcEnv })
    processes.push({ name: svc.name, proc })
  }

  // Wait for health checks if requested
  if (waitForHealthz) {
    for (const svc of services) {
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
    const proc = spawn("pnpm", uiArgs, { stdio, env: frontendEnv })
    processes.push({ name: "frontend", proc })
  }

  // Cleanup function
  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    for (const { proc } of processes) {
      proc.kill("SIGTERM")
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
