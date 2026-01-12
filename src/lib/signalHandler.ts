// Global cleanup function registry for SIGINT/SIGTERM handling
let cleanupFn: (() => void | Promise<void>) | null = null

export const registerCleanup = (fn: () => void | Promise<void>) => {
  cleanupFn = fn
}

export const unregisterCleanup = () => {
  cleanupFn = null
}

const handleSignal = async (signal: string) => {
  console.log(`\nReceived ${signal}, cleaning up...`)
  if (cleanupFn) {
    await cleanupFn()
  }
  process.exit(0)
}

// Register handlers once at module load
process.on("SIGINT", () => handleSignal("SIGINT"))
process.on("SIGTERM", () => handleSignal("SIGTERM"))
