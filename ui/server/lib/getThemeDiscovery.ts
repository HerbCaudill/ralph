import { ThemeDiscovery } from "../ThemeDiscovery.js"

/**
 * Singleton instance of ThemeDiscovery.
 */
let themeDiscoveryInstance: ThemeDiscovery | null = null

/**
 * Get the singleton ThemeDiscovery instance, initializing it if needed.
 */
export async function getThemeDiscovery(): Promise<ThemeDiscovery> {
  if (!themeDiscoveryInstance) {
    themeDiscoveryInstance = new ThemeDiscovery()
    await themeDiscoveryInstance.initialize()
  }
  return themeDiscoveryInstance
}

/**
 * Reset the ThemeDiscovery singleton (for testing).
 */
export function resetThemeDiscovery(): void {
  themeDiscoveryInstance = null
}
