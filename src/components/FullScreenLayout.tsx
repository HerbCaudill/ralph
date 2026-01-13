import React, { ReactNode } from "react"
import { Box } from "ink"
import BigText from "ink-big-text"
import Gradient from "ink-gradient"
import { useTerminalSize } from "../lib/useTerminalSize.js"

export const FullScreenLayout = ({ title, children, footer }: Props) => {
  const { columns, rows } = useTerminalSize()

  // BigText "tiny" font takes 4 rows
  // Plus borders (2 rows for outer box)
  // Plus separator line between header and content (1 row)
  const headerHeight = 5
  const footerHeight = footer ? 2 : 0 // 1 for separator, 1 for content
  const borderHeight = 2
  const contentHeight = Math.max(1, rows - headerHeight - footerHeight - borderHeight)

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
        height={headerHeight}
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
          height={footerHeight}
          borderStyle="single"
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderColor="gray"
          alignItems="center"
        >
          {footer}
        </Box>
      )}
    </Box>
  )
}

type Props = {
  title: string
  children: ReactNode
  footer?: ReactNode
}
