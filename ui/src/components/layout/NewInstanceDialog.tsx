import { useState, useCallback, useEffect, useId } from "react"
import { IconPlus, IconLoader2 } from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store"

/**
 * Dialog for creating a new Ralph instance.
 * Allows users to specify an instance name and agent name.
 */
export function NewInstanceDialog({ open, onOpenChange }: NewInstanceDialogProps) {
  const [name, setName] = useState("")
  const [agentName, setAgentName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createInstance = useAppStore(state => state.createInstance)
  const setActiveInstanceId = useAppStore(state => state.setActiveInstanceId)

  // Generate unique IDs for form elements
  const nameId = useId()
  const agentNameId = useId()

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("")
      setAgentName("")
      setError(null)
      setIsCreating(false)
    }
  }, [open])

  // Generate a unique instance ID
  const generateInstanceId = useCallback(() => {
    return `instance-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }, [])

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      const trimmedName = name.trim()
      if (!trimmedName) {
        setError("Instance name is required")
        return
      }

      setIsCreating(true)
      setError(null)

      try {
        const instanceId = generateInstanceId()
        const trimmedAgentName = agentName.trim() || trimmedName

        // Create instance via API
        const response = await fetch("/api/instances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: instanceId,
            name: trimmedName,
            agentName: trimmedAgentName,
            worktreePath: null, // Will be set by server if using worktrees
            branch: null,
          }),
        })

        const data = await response.json()

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Failed to create instance")
        }

        // Update local store
        createInstance(instanceId, trimmedName, trimmedAgentName)

        // Switch to the new instance
        setActiveInstanceId(instanceId)

        // Close dialog
        onOpenChange?.(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create instance"
        setError(message)
      } finally {
        setIsCreating(false)
      }
    },
    [name, agentName, generateInstanceId, createInstance, setActiveInstanceId, onOpenChange],
  )

  // Handle Enter key in inputs
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e)
      }
    },
    [handleSubmit],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-testid="new-instance-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPlus className="size-5" />
            New Instance
          </DialogTitle>
          <DialogDescription>
            Create a new Ralph instance to run tasks concurrently.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Feature Work, Bug Fixes"
              autoFocus
              disabled={isCreating}
              data-testid="new-instance-name-input"
            />
            <p className="text-muted-foreground text-xs">A descriptive name for this instance.</p>
          </div>

          {/* Agent Name field */}
          <div className="space-y-2">
            <Label htmlFor={agentNameId}>Agent Name (optional)</Label>
            <Input
              id={agentNameId}
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={name.trim() || "Uses instance name if empty"}
              disabled={isCreating}
              data-testid="new-instance-agent-input"
            />
            <p className="text-muted-foreground text-xs">
              Name used for task assignment. Defaults to the instance name.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
              role="alert"
              data-testid="new-instance-error"
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={isCreating}
              data-testid="new-instance-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !name.trim()}
              data-testid="new-instance-create-button"
            >
              {isCreating ?
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Creating...
                </>
              : <>
                  <IconPlus className="size-4" />
                  Create Instance
                </>
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export type NewInstanceDialogProps = {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
}
