import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { IconLoader2 } from "@tabler/icons-react"
import { MarkdownContent } from "@/components/ui/MarkdownContent"

// Types

export interface Comment {
  id: number
  issue_id: string
  author: string
  text: string
  created_at: string
}

export interface CommentsSectionProps {
  /** Task ID to fetch comments for */
  taskId: string
  /** Whether the component is in read-only mode */
  readOnly?: boolean
  /** Optional className for styling */
  className?: string
}

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 7) {
    return date.toLocaleDateString()
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`
  } else {
    return "just now"
  }
}

// CommentItem Component

interface CommentItemProps {
  comment: Comment
}

function CommentItem({ comment }: CommentItemProps) {
  return (
    <div className="border-border border-b pb-3 last:border-0 last:pb-0">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-foreground text-xs font-medium">{comment.author}</span>
        <span className="text-muted-foreground text-xs">
          {formatRelativeTime(comment.created_at)}
        </span>
      </div>
      <MarkdownContent withCodeBlocks={false}>{comment.text}</MarkdownContent>
    </div>
  )
}

// CommentsSection Component

export function CommentsSection({ taskId, readOnly = false, className }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`/api/tasks/${taskId}/comments`)

      // Check if response is OK and has JSON content type
      const contentType = response.headers.get("content-type")
      if (!response.ok || !contentType?.includes("application/json")) {
        setError(`Server error: ${response.status} ${response.statusText}`)
        return
      }

      const data = (await response.json()) as { ok: boolean; comments?: Comment[]; error?: string }

      if (data.ok && data.comments) {
        setComments(data.comments)
      } else {
        setError(data.error || "Failed to fetch comments")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch comments")
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  // Fetch comments when taskId changes
  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  // Handle adding a new comment
  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: newComment.trim() }),
      })

      // Check if response is OK and has JSON content type
      const contentType = response.headers.get("content-type")
      if (!response.ok || !contentType?.includes("application/json")) {
        setError(`Server error: ${response.status} ${response.statusText}`)
        return
      }

      const data = (await response.json()) as { ok: boolean; error?: string }
      if (data.ok) {
        setNewComment("")
        // Refetch comments to get the new one with proper ID
        await fetchComments()
      } else {
        setError(data.error || "Failed to add comment")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment")
    } finally {
      setIsSubmitting(false)
    }
  }, [taskId, newComment, isSubmitting, fetchComments])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      const modifierPressed = isMac ? e.metaKey : e.ctrlKey

      if (modifierPressed && e.key === "Enter" && newComment.trim() && !isSubmitting) {
        e.preventDefault()
        handleAddComment()
      }
    },
    [handleAddComment, newComment, isSubmitting],
  )

  return (
    <div className={cn("grid gap-2", className)}>
      <Label>Comments</Label>

      {/* Loading state */}
      {isLoading && (
        <div className="text-muted-foreground flex items-center gap-2 py-2 text-sm">
          <IconLoader2 className="h-4 w-4 animate-spin" />
          Loading comments...
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && <div className="text-destructive py-2 text-sm">{error}</div>}

      {/* Comments list */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {comments.length === 0 ?
            <p className="text-muted-foreground py-2 text-sm">No comments yet</p>
          : comments.map(comment => <CommentItem key={comment.id} comment={comment} />)}
        </div>
      )}

      {/* Add comment form */}
      {!readOnly && (
        <div className="mt-2 space-y-2">
          <Textarea
            ref={textareaRef}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            rows={2}
            disabled={isSubmitting}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add comment"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
