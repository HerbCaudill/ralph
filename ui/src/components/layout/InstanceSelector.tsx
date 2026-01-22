import { useState, useRef, useEffect } from "react"
import { IconChevronDown, IconPlus } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useAppStore, selectInstances, selectActiveInstanceId } from "@/store"
import type { RalphStatus } from "@/types"
import { NewInstanceDialog } from "./NewInstanceDialog"
import { InstanceOption } from "./InstanceOption"

/**
 * Dropdown selector for switching between Ralph instances.
 * Displays in the header showing the active instance with status indicator.
 */
export function InstanceSelector({ className, textColor }: InstanceSelectorProps) {
  const instances = useAppStore(selectInstances)
  const activeInstanceId = useAppStore(selectActiveInstanceId)
  const setActiveInstanceId = useAppStore(state => state.setActiveInstanceId)
  const [isOpen, setIsOpen] = useState(false)
  const [isNewInstanceDialogOpen, setIsNewInstanceDialogOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeInstance = instances.get(activeInstanceId)
  const instanceList = Array.from(instances.values())

  /**
   * Close dropdown when clicking outside.
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const statusConfig: Record<RalphStatus, { color: string; label: string }> = {
    stopped: {
      color: "bg-status-neutral",
      label: "Stopped",
    },
    starting: {
      color: "bg-status-warning animate-pulse",
      label: "Starting",
    },
    running: {
      color: "bg-status-success",
      label: "Running",
    },
    pausing: {
      color: "bg-status-warning animate-pulse",
      label: "Pausing",
    },
    paused: {
      color: "bg-status-warning",
      label: "Paused",
    },
    stopping: {
      color: "bg-status-warning animate-pulse",
      label: "Stopping",
    },
    stopping_after_current: {
      color: "bg-status-warning",
      label: "Stopping after task",
    },
  }

  /**
   * Get status configuration for the given status.
   */
  const getStatusConfig = (status: RalphStatus) => statusConfig[status]

  /**
   * Count running instances.
   */
  const runningCount = instanceList.filter(
    i => i.status === "running" || i.status === "starting",
  ).length

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5",
          "transition-colors",
          "text-sm font-medium",
          "hover:bg-white/20",
        )}
        style={{ color: textColor }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-testid="instance-selector"
      >
        {/**
         * Status indicator for active instance.
         */}
        {activeInstance && (
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              getStatusConfig(activeInstance.status).color,
            )}
            data-testid="instance-selector-status"
          />
        )}
        <span className="max-w-[120px] truncate">{activeInstance?.name ?? "No instance"}</span>
        {runningCount > 1 && (
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{runningCount}</span>
        )}
        <IconChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className={cn(
            "bg-popover border-border absolute top-full left-0 z-50 mt-1 w-64 rounded-md border shadow-lg",
          )}
          role="listbox"
          aria-label="Select Ralph instance"
          data-testid="instance-selector-dropdown"
        >
          <div className="max-h-80 overflow-y-auto p-1">
            <div className="text-muted-foreground px-3 py-1.5 text-xs font-medium tracking-wider uppercase">
              Instances
            </div>
            {instanceList.length === 0 ?
              <div className="text-muted-foreground px-3 py-2 text-sm">No instances</div>
            : instanceList.map(instance => (
                <InstanceOption
                  key={instance.id}
                  instance={instance}
                  isActive={instance.id === activeInstanceId}
                  statusConfig={getStatusConfig(instance.status)}
                  onSelect={() => {
                    setActiveInstanceId(instance.id)
                    setIsOpen(false)
                  }}
                />
              ))
            }
          </div>

          {/* Actions section */}
          <div className="border-border border-t p-1">
            <button
              onClick={() => {
                setIsOpen(false)
                setIsNewInstanceDialogOpen(true)
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-3 py-2 text-sm",
                "hover:bg-accent transition-colors",
              )}
              data-testid="instance-selector-new"
            >
              <IconPlus className="text-muted-foreground size-3.5" />
              <span>New Instance</span>
            </button>
          </div>
        </div>
      )}

      {/* New Instance Dialog */}
      <NewInstanceDialog open={isNewInstanceDialogOpen} onOpenChange={setIsNewInstanceDialogOpen} />
    </div>
  )
}

function InstanceOption({
  instance,
  isActive,
  statusConfig,
  onSelect,
}: {
  instance: RalphInstance
  isActive: boolean
  statusConfig: { color: string; label: string }
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded px-3 py-2 text-left",
        "hover:bg-accent transition-colors",
        isActive && "bg-accent/50",
      )}
      role="option"
      aria-selected={isActive}
      data-testid={`instance-option-${instance.id}`}
    >
      {/* Status indicator */}
      <span className={cn("size-2 shrink-0 rounded-full", statusConfig.color)} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium">{instance.name}</span>
        <span className="text-muted-foreground text-xs">{statusConfig.label}</span>
        {isActive && <IconCheck className="text-primary size-3.5 shrink-0" />}
      </div>
    </button>
  )
}

export type InstanceSelectorProps = {
  /** Additional CSS classes */
  className?: string
  /** Text color for header variant (passed from Header) */
  textColor?: string
}
