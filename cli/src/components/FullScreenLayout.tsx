import React, { ReactNode } from "react"
import { Box, Text } from "ink"
import BigText from "ink-big-text"
import Gradient from "ink-gradient"
import { useTerminalSize } from "../lib/useTerminalSize.js"

/**
 * BigText "tiny" font takes 4 rows, plus 1 for separator
 */
const HEADER_HEIGHT = 5

/**
 * Separator plus content row
 */
const FOOTER_HEIGHT = 2

/**
 * Top and bottom borders
 */
const BORDER_HEIGHT = 2

/**
 * Calculate the available content height based on terminal size
 */
export const useContentHeight = (hasFooter: boolean = true): number => {
  const { rows } = useTerminalSize()
  const footerHeight = hasFooter ? FOOTER_HEIGHT : 0
  return Math.max(1, rows - HEADER_HEIGHT - footerHeight - BORDER_HEIGHT)
}

export const FullScreenLayout = ({ title, children, footer, version }: Props) => {
  const { columns, rows } = useTerminalSize()
  const contentHeight = useContentHeight(!!footer)

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={rows}
      borderStyle="round"
      borderColor="gray"
    >
      {/* Header section */}
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height={HEADER_HEIGHT}
        borderStyle="single"
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        borderColor="gray"
      >
        <Gradient colors={["#30A6E4", "#EBC635"]}>
          <BigText text={title} font="tiny" />
        </Gradient>
      </Box>

      {/* Content section */}
      <Box
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
        height={contentHeight}
        overflowY="hidden"
      >
        {children}
      </Box>

      {/* Footer section */}
      {footer && (
        <Box
          paddingX={1}
          height={FOOTER_HEIGHT}
          borderStyle="single"
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderColor="gray"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box>{footer}</Box>
          {version && <Text dimColor>{version}</Text>}
        </Box>
      )}
    </Box>
  )
}

type Props = {
  title: string
  children: ReactNode
  footer?: ReactNode
  version?: string
}
