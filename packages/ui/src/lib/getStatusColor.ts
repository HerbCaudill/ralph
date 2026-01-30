export function getStatusColor(status?: string): string {
  switch (status) {
    case "running":
      return "bg-status-info"
    case "success":
      return "bg-status-success"
    case "error":
      return "bg-status-error"
    case "pending":
    default:
      return "bg-status-warning"
  }
}
