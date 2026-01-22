/**
 * Find the start of the previous word from cursor position.
 * A word is a sequence of non-whitespace characters.
 */
export const findPreviousWordBoundary = (
  /** The text to search */
  text: string,
  /** The current cursor position */
  cursorOffset: number,
): number => {
  if (cursorOffset <= 0) return 0

  let pos = cursorOffset

  // Skip any whitespace immediately before cursor
  while (pos > 0 && /\s/.test(text[pos - 1]!)) {
    pos--
  }

  // Skip the word (non-whitespace) characters
  while (pos > 0 && !/\s/.test(text[pos - 1]!)) {
    pos--
  }

  return pos
}
