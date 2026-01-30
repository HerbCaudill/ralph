export function unescapeJsonString(value: string): string {
  return value.replace(/\\(.)/g, (_, char) => {
    switch (char) {
      case "n":
        return "\n"
      case "t":
        return "\t"
      case "r":
        return "\r"
      default:
        return char
    }
  })
}
