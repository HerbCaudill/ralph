import type { Meta, StoryObj } from "@storybook/react-vite"
import { ErrorEvent } from "@herbcaudill/agent-view"

const meta: Meta<typeof ErrorEvent> = {
  title: "Feedback/ErrorEvent",
  component: ErrorEvent,
  parameters: {},
  decorators: [
    Story => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const GenericError: Story = {
  args: {
    event: {
      type: "error",
      timestamp: Date.now(),
      error: "Something went wrong while processing the request.",
    },
  },
}

export const ServerError: Story = {
  args: {
    event: {
      type: "server_error",
      timestamp: Date.now(),
      error: "Internal server error: Connection refused to database.",
    },
  },
}

export const NetworkError: Story = {
  args: {
    event: {
      type: "error",
      timestamp: Date.now(),
      error: "Network request failed: Unable to connect to api.example.com",
    },
  },
}

export const AuthenticationError: Story = {
  args: {
    event: {
      type: "error",
      timestamp: Date.now(),
      error: "Authentication failed: Invalid API key provided.",
    },
  },
}

export const RateLimitError: Story = {
  args: {
    event: {
      type: "server_error",
      timestamp: Date.now(),
      error: "Rate limit exceeded. Please try again in 60 seconds.",
    },
  },
}

export const ValidationError: Story = {
  args: {
    event: {
      type: "error",
      timestamp: Date.now(),
      error: "Validation error: The 'email' field must be a valid email address.",
    },
  },
}

export const LongErrorMessage: Story = {
  args: {
    event: {
      type: "error",
      timestamp: Date.now(),
      error:
        "A very long error message that contains detailed information about what went wrong during the execution of the task. This might include stack traces, file paths, and other debugging information that can help diagnose the issue. The error occurred in module X at line Y while processing request Z.",
    },
  },
}

export const TimeoutError: Story = {
  args: {
    event: {
      type: "error",
      timestamp: Date.now(),
      error: "Operation timed out after 30000ms. The server did not respond in time.",
    },
  },
}
