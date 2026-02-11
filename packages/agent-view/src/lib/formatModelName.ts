/**
 * Convert a model ID like "claude-sonnet-4-20250514" to a friendly name like "Sonnet 4".
 * Handles model IDs with or without timestamps:
 * - "claude-opus-4-6-20260101" → "Opus 4.6"
 * - "claude-opus-4-6" → "Opus 4.6"
 * - "claude-sonnet-4" → "Sonnet 4"
 * Returns the raw ID unchanged if it doesn't match a known pattern.
 */
export function formatModelName(modelId: string | undefined): string | undefined {
  if (!modelId) return undefined

  // Match patterns like "claude-sonnet-4", "claude-opus-4-6", "claude-opus-4-6-20260101"
  // Version minor is 1-2 digits; timestamp is always exactly 8 digits
  const match = modelId.match(/^claude-(\w+)-(\d+(?:-\d{1,2})?)(?:-\d{8})?$/)
  if (!match) return modelId

  const [, family, versionParts] = match
  const name = family.charAt(0).toUpperCase() + family.slice(1)
  const version = versionParts.replace("-", ".")

  return `${name} ${version}`
}
