/**
 * Get the base working directory for relative path calculations.
 * Respects RALPH_CWD environment variable if set, otherwise uses current working directory.
 */
export const getBaseCwd = () => process.env.RALPH_CWD ?? process.cwd()
