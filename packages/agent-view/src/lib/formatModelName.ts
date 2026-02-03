/**
 * Convert a model ID like "claude-sonnet-4-20250514" to a friendly name like "Sonnet 4".
 * Returns undefined if the model ID doesn't match a known pattern.
 */
export function formatModelName(modelId: string | undefined): string | undefined {
  if (!modelId) return undefined

  // Match patterns like "claude-sonnet-4-20250514" or "claude-opus-4-5-20251101"
  const match = modelId.match(/^claude-(\w+)-(\d+(?:-\d+)?)-\d{8}$/)
  if (!match) return modelId

  const [, family, versionParts] = match
  const name = family.charAt(0).toUpperCase() + family.slice(1)
  const version = versionParts.replace("-", ".")

  return `${name} ${version}`
}
