import { StatusBar } from "./StatusBar"

/**
 * Controller component for StatusBar.
 *
 * StatusBar has minimal state requirements - it simply composes child components
 * that access their own state. This controller exists for consistency with the
 * controller/presentational pattern but passes minimal props.
 */
export function StatusBarController({ className }: StatusBarControllerProps) {
  return <StatusBar className={className} />
}

/** Props for StatusBarController component. */
export type StatusBarControllerProps = {
  /** Optional CSS class name to apply to the status bar */
  className?: string
}
