/** Strips ANSI escape codes from a string. */
export function stripAnsi(
  /** The string with ANSI escape codes */
  input: string,
): string {
  return input.replace(/\x1b\[[0-9;]*m/g, "")
}

/** Checks if a string contains ANSI escape codes. */
export function hasAnsiCodes(
  /** The string to check */
  input: string,
): boolean {
  return /\x1b\[/.test(input)
}
