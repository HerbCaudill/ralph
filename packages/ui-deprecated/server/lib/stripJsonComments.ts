/**
 * Strip JSON comments from a string.
 * Handles both single-line (//) and multi-line (/* * /) comments.
 * Preserves strings that contain // or /* characters.
 */
export function stripJsonComments(
  /** JSON string that may contain comments */
  json: string,
): string {
  let result = ""
  let inString = false
  let inSingleComment = false
  let inMultiComment = false
  let i = 0

  while (i < json.length) {
    const char = json[i]
    const nextChar = json[i + 1]

    // Handle string state
    if (!inSingleComment && !inMultiComment) {
      if (char === '"' && json[i - 1] !== "\\") {
        inString = !inString
        result += char
        i++
        continue
      }
    }

    // If we're in a string, just copy characters
    if (inString) {
      result += char
      i++
      continue
    }

    // Handle comment start
    if (!inSingleComment && !inMultiComment) {
      if (char === "/" && nextChar === "/") {
        inSingleComment = true
        i += 2
        continue
      }
      if (char === "/" && nextChar === "*") {
        inMultiComment = true
        i += 2
        continue
      }
    }

    // Handle single-line comment end
    if (inSingleComment) {
      if (char === "\n") {
        inSingleComment = false
        result += char // Keep the newline
      }
      i++
      continue
    }

    // Handle multi-line comment end
    if (inMultiComment) {
      if (char === "*" && nextChar === "/") {
        inMultiComment = false
        i += 2
        continue
      }
      i++
      continue
    }

    // Regular character
    result += char
    i++
  }

  return result
}
