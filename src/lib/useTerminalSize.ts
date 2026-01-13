import { useState, useEffect } from "react"
import { useStdout } from "ink"

export const useTerminalSize = () => {
  const { stdout } = useStdout()

  const getSize = () => ({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  })

  const [size, setSize] = useState(getSize)

  useEffect(() => {
    const handleResize = () => {
      setSize(getSize())
    }

    stdout?.on("resize", handleResize)

    return () => {
      stdout?.off("resize", handleResize)
    }
  }, [stdout])

  return size
}
