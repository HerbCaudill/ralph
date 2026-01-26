import React, { useMemo, useState, useEffect, useRef } from "react"
import { Box, Text, useInput } from "ink"
import { formatSessionHeader } from "../lib/formatSessionHeader.js"
import { processEvents } from "./processEvents.js"
import { blocksToLines } from "./blocksToLines.js"

export const EventDisplay = ({ events, session, completedSessions, height }: Props) => {
  // Scroll offset from bottom (0 = at bottom, positive = scrolled up)
  const [scrollOffset, setScrollOffset] = useState(0)
  // Track if user has manually scrolled
  const userScrolledRef = useRef(false)
  // Track previous line count for auto-scroll
  const prevLineCountRef = useRef(0)

  // Convert all content to lines for virtual scrolling
  const allLines = useMemo(() => {
    const lines: string[] = []

    // Add completed sessions
    for (const completed of completedSessions) {
      lines.push("")
      lines.push("")
      lines.push(formatSessionHeader(completed.session))
      lines.push("")
      const blocks = processEvents(completed.events)
      lines.push(...blocksToLines(blocks))
    }

    // Add current session
    lines.push("")
    lines.push("")
    lines.push(formatSessionHeader(session))
    lines.push("")
    const currentBlocks = processEvents(events)
    lines.push(...blocksToLines(currentBlocks))

    return lines
  }, [events, session, completedSessions])

  // Auto-scroll to bottom when new content arrives (unless user scrolled up)
  useEffect(() => {
    if (allLines.length > prevLineCountRef.current && !userScrolledRef.current) {
      setScrollOffset(0)
    }
    prevLineCountRef.current = allLines.length
  }, [allLines.length])

  // Handle keyboard input for scrolling
  useInput((input, key) => {
    if (!height) return

    const maxOffset = Math.max(0, allLines.length - height)
    const pageSize = Math.max(1, height - 2)

    if (key.upArrow || input === "k") {
      userScrolledRef.current = true
      setScrollOffset(prev => Math.min(maxOffset, prev + 1))
    } else if (key.downArrow || input === "j") {
      const newOffset = Math.max(0, scrollOffset - 1)
      setScrollOffset(newOffset)
      if (newOffset === 0) {
        userScrolledRef.current = false
      }
    } else if (key.pageUp) {
      userScrolledRef.current = true
      setScrollOffset(prev => Math.min(maxOffset, prev + pageSize))
    } else if (key.pageDown) {
      const newOffset = Math.max(0, scrollOffset - pageSize)
      setScrollOffset(newOffset)
      if (newOffset === 0) {
        userScrolledRef.current = false
      }
    } else if (input === "g" && key.shift) {
      // Shift+G = go to bottom
      setScrollOffset(0)
      userScrolledRef.current = false
    } else if (input === "g") {
      // g = go to top
      userScrolledRef.current = true
      setScrollOffset(maxOffset)
    }
  })

  // Calculate visible lines based on scroll position
  const visibleLines = useMemo(() => {
    if (!height || allLines.length <= height) {
      return allLines
    }
    const endIndex = allLines.length - scrollOffset
    const startIndex = Math.max(0, endIndex - height)
    return allLines.slice(startIndex, endIndex)
  }, [allLines, height, scrollOffset])

  return (
    <Box flexDirection="column">
      {visibleLines.map((line, index) => (
        <Text key={index} wrap="wrap">
          {line || " "}
        </Text>
      ))}
    </Box>
  )
}

type SessionEvents = {
  session: number
  events: Array<Record<string, unknown>>
}

type Props = {
  events: Array<Record<string, unknown>>
  session: number
  completedSessions: SessionEvents[]
  height?: number
}
