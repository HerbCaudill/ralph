/**
 * Converts ANSI escape codes in terminal output to styled HTML spans.
 * Supports standard 16 colors, 256 colors, and true color (RGB) modes.
 */

// ANSI color name to CSS color mapping
const STANDARD_COLORS: Record<string, string> = {
  "30": "#000000", // black
  "31": "#cd0000", // red
  "32": "#00cd00", // green
  "33": "#cdcd00", // yellow
  "34": "#0000ee", // blue
  "35": "#cd00cd", // magenta
  "36": "#00cdcd", // cyan
  "37": "#e5e5e5", // white
  "90": "#7f7f7f", // bright black (gray)
  "91": "#ff0000", // bright red
  "92": "#00ff00", // bright green
  "93": "#ffff00", // bright yellow
  "94": "#5c5cff", // bright blue
  "95": "#ff00ff", // bright magenta
  "96": "#00ffff", // bright cyan
  "97": "#ffffff", // bright white
}

const BG_COLORS: Record<string, string> = {
  "40": "#000000",
  "41": "#cd0000",
  "42": "#00cd00",
  "43": "#cdcd00",
  "44": "#0000ee",
  "45": "#cd00cd",
  "46": "#00cdcd",
  "47": "#e5e5e5",
  "100": "#7f7f7f",
  "101": "#ff0000",
  "102": "#00ff00",
  "103": "#ffff00",
  "104": "#5c5cff",
  "105": "#ff00ff",
  "106": "#00ffff",
  "107": "#ffffff",
}

// 256-color palette (colors 16-231 are a 6x6x6 color cube, 232-255 are grayscale)
function get256Color(n: number): string {
  if (n < 16) {
    // Standard colors 0-15
    const standardMap: Record<number, string> = {
      0: "#000000",
      1: "#cd0000",
      2: "#00cd00",
      3: "#cdcd00",
      4: "#0000ee",
      5: "#cd00cd",
      6: "#00cdcd",
      7: "#e5e5e5",
      8: "#7f7f7f",
      9: "#ff0000",
      10: "#00ff00",
      11: "#ffff00",
      12: "#5c5cff",
      13: "#ff00ff",
      14: "#00ffff",
      15: "#ffffff",
    }
    return standardMap[n] || "#ffffff"
  } else if (n < 232) {
    // 6x6x6 color cube
    const idx = n - 16
    const r = Math.floor(idx / 36)
    const g = Math.floor((idx % 36) / 6)
    const b = idx % 6
    const toHex = (v: number) => {
      const level = v === 0 ? 0 : 55 + v * 40
      return level.toString(16).padStart(2, "0")
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  } else {
    // Grayscale 232-255
    const gray = 8 + (n - 232) * 10
    const hex = gray.toString(16).padStart(2, "0")
    return `#${hex}${hex}${hex}`
  }
}

interface AnsiState {
  color?: string
  bgColor?: string
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
}

function parseAnsiCodes(codes: string): Partial<AnsiState> {
  const parts = codes.split(";").map(c => parseInt(c, 10))
  const state: Partial<AnsiState> = {}

  for (let i = 0; i < parts.length; i++) {
    const code = parts[i]

    // Reset
    if (code === 0) {
      return {
        color: undefined,
        bgColor: undefined,
        bold: undefined,
        dim: undefined,
        italic: undefined,
        underline: undefined,
      }
    }

    // Style codes
    if (code === 1) state.bold = true
    if (code === 2) state.dim = true
    if (code === 3) state.italic = true
    if (code === 4) state.underline = true
    if (code === 22) {
      state.bold = false
      state.dim = false
    }
    if (code === 23) state.italic = false
    if (code === 24) state.underline = false

    // Foreground colors (30-37, 90-97)
    if (STANDARD_COLORS[String(code)]) {
      state.color = STANDARD_COLORS[String(code)]
    }

    // Background colors (40-47, 100-107)
    if (BG_COLORS[String(code)]) {
      state.bgColor = BG_COLORS[String(code)]
    }

    // Default foreground/background
    if (code === 39) state.color = undefined
    if (code === 49) state.bgColor = undefined

    // 256-color mode: 38;5;n or 48;5;n
    if (code === 38 && parts[i + 1] === 5) {
      state.color = get256Color(parts[i + 2])
      i += 2
    }
    if (code === 48 && parts[i + 1] === 5) {
      state.bgColor = get256Color(parts[i + 2])
      i += 2
    }

    // True color: 38;2;r;g;b or 48;2;r;g;b
    if (code === 38 && parts[i + 1] === 2) {
      const r = parts[i + 2]
      const g = parts[i + 3]
      const b = parts[i + 4]
      state.color = `rgb(${r},${g},${b})`
      i += 4
    }
    if (code === 48 && parts[i + 1] === 2) {
      const r = parts[i + 2]
      const g = parts[i + 3]
      const b = parts[i + 4]
      state.bgColor = `rgb(${r},${g},${b})`
      i += 4
    }
  }

  return state
}

function stateToStyle(state: AnsiState): string {
  const styles: string[] = []
  if (state.color) styles.push(`color:${state.color}`)
  if (state.bgColor) styles.push(`background-color:${state.bgColor}`)
  if (state.bold) styles.push("font-weight:bold")
  if (state.dim) styles.push("opacity:0.5")
  if (state.italic) styles.push("font-style:italic")
  if (state.underline) styles.push("text-decoration:underline")
  return styles.join(";")
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Converts a string containing ANSI escape codes to HTML with inline styles.
 * @param input The string with ANSI escape codes
 * @returns HTML string with styled spans
 */
export function ansiToHtml(input: string): string {
  // ANSI escape sequence regex: ESC [ ... m
  const ansiRegex = /\x1b\[([0-9;]*)m/g

  let result = ""
  let lastIndex = 0
  let state: AnsiState = {}
  let match

  while ((match = ansiRegex.exec(input)) !== null) {
    // Add text before this escape sequence
    const textBefore = input.slice(lastIndex, match.index)
    if (textBefore) {
      const style = stateToStyle(state)
      if (style) {
        result += `<span style="${style}">${escapeHtml(textBefore)}</span>`
      } else {
        result += escapeHtml(textBefore)
      }
    }

    // Parse and apply the ANSI codes
    const codes = match[1] || "0"
    const newState = parseAnsiCodes(codes)

    // Merge new state into current state
    state = {
      color: newState.color !== undefined ? newState.color : state.color,
      bgColor: newState.bgColor !== undefined ? newState.bgColor : state.bgColor,
      bold: newState.bold !== undefined ? newState.bold : state.bold,
      dim: newState.dim !== undefined ? newState.dim : state.dim,
      italic: newState.italic !== undefined ? newState.italic : state.italic,
      underline: newState.underline !== undefined ? newState.underline : state.underline,
    }

    // Handle explicit reset
    if (codes === "0" || codes === "") {
      state = {}
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  const remaining = input.slice(lastIndex)
  if (remaining) {
    const style = stateToStyle(state)
    if (style) {
      result += `<span style="${style}">${escapeHtml(remaining)}</span>`
    } else {
      result += escapeHtml(remaining)
    }
  }

  return result
}

/**
 * Strips ANSI escape codes from a string.
 * @param input The string with ANSI escape codes
 * @returns Plain text without ANSI codes
 */
export function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, "")
}

/**
 * Checks if a string contains ANSI escape codes.
 * @param input The string to check
 * @returns true if the string contains ANSI codes
 */
export function hasAnsiCodes(input: string): boolean {
  return /\x1b\[/.test(input)
}
