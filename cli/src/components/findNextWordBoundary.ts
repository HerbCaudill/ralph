/**
 * Find the end of the next word from cursor position.
 * A word is a sequence of non-whitespace characters.
 */
export const findNextWordBoundary = (
  /** The text to search */
  text: string,
  /** The current cursor position */
  cursorOffset: number,
): number => {
  if (cursorOffset >= text.length) return text.length

  let pos = cursorOffset

  // Skip any whitespace immediately after cursor
  while (pos < text.length && /\s/.test(text[pos]!)) {
    pos++
  }

  // Skip the word (non-whitespace) characters
  while (pos < text.length && !/\s/.test(text[pos]!)) {
    pos++
  }

  return pos
}
