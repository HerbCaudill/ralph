/**
 * Output an event as newline-delimited JSON to stdout.
 */
export const outputEvent = (
  /** The event object to output */
  event: Record<string, unknown>,
) => {
  process.stdout.write(JSON.stringify(event) + "\n")
}
