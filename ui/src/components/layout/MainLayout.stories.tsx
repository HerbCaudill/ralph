import type { Meta, StoryObj } from "@storybook/react-vite"
import { MainLayout } from "./MainLayout"
import { withStoreState, fullPageDecorator } from "../../../.storybook/decorators"
import { StatusBar } from "./StatusBar"
import { TaskList } from "../tasks/TaskList"
import type { TaskCardTask } from "../tasks/TaskCard"

const meta: Meta<typeof MainLayout> = {
  title: "Layout/MainLayout",
  component: MainLayout,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
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
      iteration: { current: 3, total: 10 },
      sidebarOpen: true,
      accentColor: "#007ACC",
    }),
  ],
}

export const SidebarClosed: Story = {
  args: {
    sidebar: <TaskList tasks={sampleTasks} persistCollapsedState={false} />,
    main: (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Main Content</h1>
        <p className="text-muted-foreground">
          The sidebar is collapsed. Click the toggle button to expand it.
        </p>
      </div>
    ),
    statusBar: <StatusBar />,
  },
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
      workspace: "/Users/dev/projects/my-app",
      branch: "main",
      tokenUsage: { input: 0, output: 0 },
      iteration: { current: 0, total: 0 },
      sidebarOpen: false,
      accentColor: "#42B883",
    }),
  ],
}

export const WithoutStatusBar: Story = {
  args: {
    sidebar: <div className="p-4">Sidebar Content</div>,
    main: <div className="p-4">Main Content without status bar</div>,
  },
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      sidebarOpen: true,
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
      sidebarOpen: true,
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
      sidebarOpen: true,
    }),
  ],
}
