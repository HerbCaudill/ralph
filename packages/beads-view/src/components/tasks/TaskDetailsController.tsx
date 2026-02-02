import type { ReactNode } from "react"
import { useTaskDetails } from "../../hooks/useTaskDetails"
import { TaskDetails } from "./TaskDetails"
import type { TaskCardTask, TaskUpdateData } from "../../types"

/**
 * Controller component for TaskDetails.
 *
 * Connects the useTaskDetails hook to the TaskDetails presentational component.
 * This is the entry point for using TaskDetails in the application.
 */
export function TaskDetailsController({
  task,
  open,
  onClose,
  onSave,
  onDelete,
  readOnly = false,
  renderDescriptionEditor,
  renderSessionLinks,
}: TaskDetailsControllerProps) {
  const {
    formValues,
    labels,
    issuePrefix,
    allTasks,
    isSaving,
    isDeleting,
    isAddingLabel,
    isConfirmingDelete,
    deleteError,
    newLabel,
    showLabelInput,
    comments,
    isLoadingComments,
    commentsError,
    updateTitle,
    updateDescription,
    updateStatus,
    updatePriority,
    updateIssueType,
    updateParent,
    setNewLabel,
    setShowLabelInput,
    handleAddLabel,
    handleRemoveLabel,
    handleAddComment,
    startDelete,
    cancelDelete,
    confirmDelete,
    handleClose,
  } = useTaskDetails({
    task,
    open,
    readOnly,
    onSave,
    onDelete,
    onClose,
  })

  return (
    <TaskDetails
      task={task}
      open={open}
      readOnly={readOnly}
      formValues={formValues}
      labels={labels}
      issuePrefix={issuePrefix}
      allTasks={allTasks}
      isSaving={isSaving}
      isDeleting={isDeleting}
      isAddingLabel={isAddingLabel}
      isConfirmingDelete={isConfirmingDelete}
      deleteError={deleteError}
      newLabel={newLabel}
      showLabelInput={showLabelInput}
      comments={comments}
      isLoadingComments={isLoadingComments}
      commentsError={commentsError}
      canDelete={!!onDelete}
      onUpdateTitle={updateTitle}
      onUpdateDescription={updateDescription}
      onUpdateStatus={updateStatus}
      onUpdatePriority={updatePriority}
      onUpdateIssueType={updateIssueType}
      onUpdateParent={updateParent}
      onSetNewLabel={setNewLabel}
      onSetShowLabelInput={setShowLabelInput}
      onAddLabel={handleAddLabel}
      onRemoveLabel={handleRemoveLabel}
      onAddComment={handleAddComment}
      onStartDelete={startDelete}
      onCancelDelete={cancelDelete}
      onConfirmDelete={confirmDelete}
      onClose={handleClose}
      renderDescriptionEditor={renderDescriptionEditor}
      renderSessionLinks={renderSessionLinks}
    />
  )
}

/** Props for TaskDetailsController component. */
export type TaskDetailsControllerProps = {
  /** The task to display/edit */
  task: TaskCardTask | null
  /** Whether the dialog is open */
  open: boolean
  /** Callback when close is requested */
  onClose: () => void
  /** Callback when save is requested */
  onSave?: (id: string, updates: TaskUpdateData) => void | Promise<void>
  /** Callback when delete is requested */
  onDelete?: (id: string) => void | Promise<void>
  /** Whether the dialog is in read-only mode */
  readOnly?: boolean
  /** Optional custom renderer for the description editor */
  renderDescriptionEditor?: (options: {
    /** Description value */
    value: string
    /** Handler for description changes */
    onChange: (value: string) => void
    /** Placeholder text */
    placeholder?: string
  }) => ReactNode
  /** Optional renderer for session links */
  renderSessionLinks?: (taskId: string) => ReactNode
}
