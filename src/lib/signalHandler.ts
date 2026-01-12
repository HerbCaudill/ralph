// Global cleanup function registry for SIGINT/SIGTERM handling
let cleanupFn: (() => void | Promise<void>) | null = null
let isCleaningUp = false

export const registerCleanup = (fn: () => void | Promise<void>) => {
  cleanupFn = fn
}

export const unregisterCleanup = () => {
  cleanupFn = null
}

const handleSignal = async () => {
  // Prevent double handling
  if (isCleaningUp) return
  isCleaningUp = true

  if (cleanupFn) {
    await cleanupFn()
  }
  process.exit(0)
}

// Register handlers once at module load
process.on("SIGINT", () => handleSignal())
process.on("SIGTERM", () => handleSignal())
