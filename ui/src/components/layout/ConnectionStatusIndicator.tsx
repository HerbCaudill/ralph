import { cn } from "@/lib/utils"
import { useAppStore, selectConnectionStatus } from "@/store"
import type { ConnectionStatus } from "@/hooks/useWebSocket"
import { IconBolt, IconBoltOff, IconLoader2 } from "@tabler/icons-react"
import type { ComponentType } from "react"

type IconProps = { className?: string; size?: number }

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
 */
export function ConnectionStatusIndicator({ className }: ConnectionStatusIndicatorProps) {
  const connectionStatus = useAppStore(selectConnectionStatus)
  const config = connectionStatusConfig[connectionStatus]

  const Icon = config.icon
  const isConnecting = connectionStatus === "connecting"

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      title={config.description}
      data-testid="connection-status-indicator"
    >
      <Icon
        className={cn(config.color, isConnecting && "animate-spin")}
        size={14}
        data-testid="connection-status-icon"
      />
      <span className="text-muted-foreground text-xs" data-testid="connection-status-label">
        {config.label}
      </span>
    </div>
  )
}

export type ConnectionStatusIndicatorProps = {
  className?: string
}
