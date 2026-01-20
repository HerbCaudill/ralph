export const shortenTempPaths = (text: string) => {
  // Replace temp file paths with just the filename
  return text
    .replace(/\/var\/folders\/[^\s]+/g, match => match.split("/").pop() || match)
    .replace(/\/tmp\/[^\s]+/g, match => match.split("/").pop() || match)
}
