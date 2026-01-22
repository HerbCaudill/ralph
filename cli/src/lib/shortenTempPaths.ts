/**
 * Replace temp file paths with just the filename.
 * Shortens macOS and Linux temporary paths to be more readable in output.
 */
export const shortenTempPaths = (
  /** The text to process */
  text: string,
) => {
  return text
    .replace(/\/var\/folders\/[^\s]+/g, match => match.split("/").pop() || match)
    .replace(/\/tmp\/[^\s]+/g, match => match.split("/").pop() || match)
}
