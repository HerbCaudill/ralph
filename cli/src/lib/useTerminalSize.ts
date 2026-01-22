import { useState, useEffect } from "react"
import { useStdout } from "ink"
import { getTerminalSize } from "./getTerminalSize.js"

/**
 * Hook to get the current terminal size and subscribe to resize events.
 */
export const useTerminalSize = () => {
  const { stdout } = useStdout()
  const [size, setSize] = useState(() => getTerminalSize(stdout))

  useEffect(() => {
    const handleResize = () => {
      setSize(getTerminalSize(stdout))
    }

    stdout?.on("resize", handleResize)

    return () => {
      stdout?.off("resize", handleResize)
    }
  }, [stdout])

  return size
}
