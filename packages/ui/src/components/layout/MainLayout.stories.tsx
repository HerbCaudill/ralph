import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within } from "storybook/test"
import { MainLayout } from "./MainLayout"
import { withStoreState, fullPageDecorator } from "../../../.storybook/decorators"
import { StatusBar } from "./StatusBar"
import { TaskList } from "../tasks/TaskList"
import type { TaskCardTask } from "@/types"

const meta: Meta<typeof MainLayout> = {
  title: "Panels/MainLayout",
  component: MainLayout,
  parameters: {},
  decorators: [fullPageDecorator],
}

export default meta
type Story = StoryObj<typeof meta>

const sampleTasks: TaskCardTask[] = [
  { id: "rui-001", title: "Implement login page", status: "in_progress", priority: 1 },
  { id: "rui-002", title: "Add unit tests", status: "open", priority: 2 },
  { id: "rui-003", title: "Fix navigation bug", status: "blocked", priority: 0 },
  { id: "rui-004", title: "Update documentation", status: "open", priority: 3 },
  { id: "rui-005", title: "Refactor API client", status: "closed", priority: 2 },
]

export const Default: Story = {
  args: {
    sidebar: <TaskList tasks={sampleTasks} persistCollapsedState={false} />,
    main: (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Main Content Area</h1>
        <p className="text-muted-foreground">
          This is the main content area where the event stream, chat, and other primary content
          would be displayed.
        </p>
      </div>
    ),
    statusBar: <StatusBar />,
  },
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "running",
      workspace: "/Users/dev/projects/my-app",
      branch: "main",
      tokenUsage: { input: 12500, output: 3200 },
      session: { current: 3, total: 10 },
      accentColor: "#007ACC",
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Main content area should be visible
    await expect(canvas.getByText("Main Content Area")).toBeInTheDocument()

    // Sidebar content should be visible (a task title from the sample data)
    await expect(canvas.getByText("Implement login page")).toBeInTheDocument()
  },
}

export const WithoutStatusBar: Story = {
  args: {
    sidebar: <div className="p-4">Sidebar Content</div>,
    main: <div className="p-4">Main Content without status bar</div>,
  },
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      accentColor: "#9B59B6",
    }),
  ],
}

export const CustomHeader: Story = {
  args: {
    header: (
      <div className="bg-primary text-primary-foreground flex h-14 items-center px-4">
        <span className="font-bold">Custom Header</span>
      </div>
    ),
    sidebar: <div className="p-4">Sidebar Content</div>,
    main: <div className="p-4">Main Content with custom header</div>,
    statusBar: <StatusBar />,
  },
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "running",
    }),
  ],
}

export const NoHeader: Story = {
  args: {
    showHeader: false,
    sidebar: <div className="p-4">Sidebar Content</div>,
    main: <div className="p-4">Main Content without header</div>,
    statusBar: <StatusBar />,
  },
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
}
