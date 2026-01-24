/**  Get the current terminal size with sensible defaults. */
export function getTerminalSize(
  /** The stdout object from Ink's useStdout hook */
  stdout: any,
) {
  return {
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  }
}
