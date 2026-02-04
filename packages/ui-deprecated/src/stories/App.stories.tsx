import type { Meta, StoryObj } from "@storybook/react-vite"
import { App } from ".././App"
import { withImportedState, fullPageDecorator } from "../../.storybook/decorators"

/**
 * Full application stories for debugging and reproducing issues.
 *
 * These stories load real exported state from gzipped JSON files,
 * allowing developers to reproduce specific application states for debugging.
 */
const meta: Meta<typeof App> = {
  title: "Pages/App",
  component: App,
  parameters: {
    // Full-screen layout for the complete app
    layout: "fullscreen",
  },
  decorators: [fullPageDecorator],
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Reproduce issue h5j8 using captured state.
 *
 * This story loads the full application state from a gzipped JSON file
 * that was exported when the issue was observed. This allows developers
 * to see the exact state that caused the problem.
 *
 * State includes:
 * - Zustand store state (via localStorage)
 * - IndexedDB data (sessions, events, chat sessions, sync state)
 */
export const ReproduceH5j8: Story = {
  decorators: [withImportedState("/fixtures/reproduce-h5j8.json.gz")],
}
