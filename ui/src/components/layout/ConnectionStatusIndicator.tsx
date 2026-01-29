import { cn } from "@/lib/utils"
import { useAppStore, selectConnectionStatus } from "@/store"
import type { ConnectionStatus } from "@/store"
import { IconBolt, IconBoltOff, IconLoader2 } from "@tabler/icons-react"
import type { ComponentType } from "react"

type IconProps = { className?: string; size?: number; style?: React.CSSProperties }

const connectionStatusConfig: Record<
  ConnectionStatus,
  { color: string; icon: ComponentType<IconProps>; label: string; description: string }
> = {
  disconnected: {
    color: "text-status-error",
    icon: IconBoltOff,
    label: "Disconnected",
    description: "Connection lost. Attempting to reconnect...",
  },
  connecting: {
    color: "text-status-warning",
    icon: IconLoader2,
    label: "Connecting",
    description: "Establishing connection to server...",
  },
  connected: {
    color: "text-status-success",
    icon: IconBolt,
    label: "Connected",
    description: "Connected to server",
  },
}

/**
 * Visual indicator showing WebSocket connection status.
 * Shows connected/connecting/disconnected states with appropriate icons and colors.
 * Only shows the label when not connected to draw attention to connection issues.
 */
export function ConnectionStatusIndicator({
  className,
  textColor,
}: ConnectionStatusIndicatorProps) {
  const connectionStatus = useAppStore(selectConnectionStatus)
  const config = connectionStatusConfig[connectionStatus]

  // Only show the full indicator (with label) when not connected
  // When connected, just show the icon to minimize visual noise
  const showLabel = connectionStatus !== "connected"

  const Icon = config.icon
  const isConnecting = connectionStatus === "connecting"

  // When connected and textColor is provided (e.g., in header), use it for the icon
  // Otherwise use the config color for visibility during connection issues
  const useCustomColor = connectionStatus === "connected" && textColor

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      title={config.description}
      data-testid="connection-status-indicator"
    >
      <Icon
        className={cn(!useCustomColor && config.color, isConnecting && "animate-spin")}
        style={useCustomColor ? { color: textColor } : undefined}
        size={18}
        data-testid="connection-status-icon"
      />
      {showLabel && (
        <span className="text-muted-foreground text-xs" data-testid="connection-status-label">
          {config.label}
        </span>
      )}
    </div>
  )
}

export type ConnectionStatusIndicatorProps = {
  className?: string
  /** Text color to use when connected (for header integration) */
  textColor?: string
}
