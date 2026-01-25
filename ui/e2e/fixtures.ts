import { test as base, expect, type Page, type Locator } from "@playwright/test"

/**  Page object for the task sidebar/list */
export class TaskListPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly quickTaskInput: Locator
  readonly searchInput: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = page.getByRole("complementary", { name: "Task sidebar" })
    this.quickTaskInput = page.getByLabel("New task title")
    this.searchInput = page.getByPlaceholder("Search")
  }

  /** Create a new task using the quick input */
  async createTask(title: string) {
    await this.quickTaskInput.fill(title)
    await this.quickTaskInput.press("Enter")
    // Wait for the task to appear in the list - look specifically for the task card's title span
    await expect(this.sidebar.locator("span.truncate", { hasText: title })).toBeVisible()
  }

  /** Search for tasks */
  async search(query: string) {
    await this.searchInput.fill(query)
  }

  /** Clear the search input */
  async clearSearch() {
    await this.searchInput.clear()
  }

  /** Click on a task by its ID */
  async clickTask(taskId: string) {
    await this.page.getByText(taskId).click()
  }

  /** Toggle a task group (Ready, In progress, Blocked, Closed) */
  async toggleGroup(groupName: string) {
    await this.page.getByRole("button", { name: new RegExp(groupName, "i") }).click()
  }

  /** Get all visible task cards */
  async getVisibleTasks(): Promise<Locator> {
    return this.sidebar
      .getByRole("button")
      .filter({ has: this.page.locator("[class*='task-card']") })
  }

  /** Change a task's status using the status dropdown */
  async changeTaskStatus(taskId: string, newStatus: string) {
    // Find the task card and click its status button
    const taskCard = this.page.locator(`[data-task-id="${taskId}"]`)
    await taskCard.getByRole("button", { name: /status/i }).click()

    // Select the new status from the dropdown
    await this.page.getByRole("option", { name: new RegExp(newStatus, "i") }).click()
  }

  /** Filter closed tasks by time period */
  async filterClosedTasks(filter: "past_hour" | "past_day" | "past_week" | "all_time") {
    const filterButton = this.page.getByLabel("Filter closed tasks by time")
    await filterButton.click()
    await this.page.getByRole("option", { name: new RegExp(filter.replace("_", " "), "i") }).click()
  }
}

/**  Page object for the task details dialog */
export class TaskDetailsPage {
  readonly page: Page
  readonly dialog: Locator

  constructor(page: Page) {
    this.page = page
    this.dialog = page.getByRole("dialog")
  }

  /** Check if the dialog is open */
  async isOpen(): Promise<boolean> {
    return this.dialog.isVisible()
  }

  /** Wait for the dialog to open */
  async waitForOpen() {
    await expect(this.dialog).toBeVisible()
  }

  /** Close the dialog */
  async close() {
    await this.page.keyboard.press("Escape")
    await expect(this.dialog).not.toBeVisible()
  }

  /** Update the task title */
  async setTitle(title: string) {
    const titleInput = this.dialog.getByRole("textbox", { name: /title/i })
    await titleInput.clear()
    await titleInput.fill(title)
  }

  /** Update the task description */
  async setDescription(description: string) {
    const descInput = this.dialog.getByRole("textbox", { name: /description/i })
    await descInput.clear()
    await descInput.fill(description)
  }

  /** Set the task type (task, bug, epic) */
  async setType(type: "task" | "bug" | "epic") {
    const typeGroup = this.dialog.getByRole("group")
    await typeGroup.getByRole("button", { name: new RegExp(type, "i") }).click()
  }

  /** Set the task priority */
  async setPriority(priority: number) {
    await this.dialog.getByLabel(/priority/i).selectOption(`${priority}`)
  }

  /** Delete the task */
  async delete() {
    await this.dialog.getByRole("button", { name: /delete/i }).click()
    // Confirm deletion
    await this.page.getByRole("button", { name: /yes/i }).click()
  }

  /** Save changes (Cmd+Enter) */
  async save() {
    await this.page.keyboard.press("Meta+Enter")
  }
}

/**  Page object for the chat panel */
export class ChatPanelPage {
  readonly page: Page
  readonly panel: Locator
  readonly messageInput: Locator
  readonly messagesContainer: Locator

  constructor(page: Page) {
    this.page = page
    this.panel = page.locator('[data-testid="left-panel"]')
    this.messageInput = page.getByRole("textbox", { name: "Message input" })
    this.messagesContainer = page.getByRole("log").first()
  }

  /** Send a message in the chat */
  async sendMessage(message: string) {
    await this.messageInput.fill(message)
    await this.messageInput.press("Enter")
  }

  /** Clear chat history */
  async clearHistory() {
    await this.page.getByLabel("Clear chat history").click()
  }

  /** Close the chat panel */
  async close() {
    await this.page.getByLabel("Close task chat").click()
  }

  /** Check if the chat is showing a loading state */
  async isLoading(): Promise<boolean> {
    return this.page.getByText("Thinking...").isVisible()
  }

  /** Wait for a response from the assistant */
  async waitForResponse(timeout = 30000) {
    // Wait for "Thinking..." to disappear
    await expect(this.page.getByText("Thinking...")).not.toBeVisible({ timeout })
  }

  /** Get the last message content */
  async getLastMessage(): Promise<string> {
    const messages = this.messagesContainer.locator('[class*="message"]')
    const lastMessage = messages.last()
    return lastMessage.textContent() ?? ""
  }

  /** Scroll to the bottom of the chat */
  async scrollToBottom() {
    const scrollButton = this.page.getByRole("button", { name: /scroll.*bottom/i })
    if (await scrollButton.isVisible()) {
      await scrollButton.click()
    }
  }
}

/**  Page object for the event stream */
export class EventStreamPage {
  readonly page: Page
  readonly container: Locator
  readonly iterationBar: Locator

  constructor(page: Page) {
    this.page = page
    this.container = page.getByRole("log", { name: "Event stream" })
    this.iterationBar = page.locator('[data-testid="iteration-bar"]')
  }

  /** Navigate to the previous iteration */
  async previousIteration() {
    await this.iterationBar.getByRole("button", { name: /previous/i }).click()
  }

  /** Navigate to the next iteration */
  async nextIteration() {
    await this.iterationBar.getByRole("button", { name: /next/i }).click()
  }

  /** Navigate to the latest iteration */
  async latestIteration() {
    await this.iterationBar.getByRole("button", { name: /latest/i }).click()
  }

  /** Check if Ralph is currently running */
  async isRunning(): Promise<boolean> {
    return this.page.locator('[data-testid="ralph-running-spinner"]').isVisible()
  }

  /** Get the current task info from the event stream */
  async getCurrentTask(): Promise<{ id: string; title: string } | null> {
    const taskLink = this.container.locator('[class*="task-link"]').first()
    if (!(await taskLink.isVisible())) {
      return null
    }
    const text = (await taskLink.textContent()) ?? ""
    const match = text.match(/^([\w-]+)\s*(.*)$/)
    if (!match) return null
    return { id: match[1], title: match[2] }
  }

  /** Wait for a specific tool to appear in the event stream */
  async waitForTool(toolName: string, timeout = 30000) {
    await expect(this.container.getByText(toolName)).toBeVisible({ timeout })
  }

  /** Get all tool use cards */
  async getToolCards(): Promise<Locator> {
    return this.container.locator('[class*="tool-card"]')
  }

  /** Scroll to the bottom of the event stream */
  async scrollToBottom() {
    const scrollButton = this.page.getByRole("button", { name: /scroll.*bottom/i })
    if (await scrollButton.isVisible()) {
      await scrollButton.click()
    }
  }
}

/**  Page object for the control bar (Start/Pause/Stop buttons) */
export class ControlBarPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** Start the agent */
  async start() {
    await this.page.getByRole("button", { name: "Start" }).click()
  }

  /** Pause the agent */
  async pause() {
    await this.page.getByRole("button", { name: "Pause" }).click()
  }

  /** Resume the agent */
  async resume() {
    await this.page.getByRole("button", { name: "Resume" }).click()
  }

  /** Stop the agent */
  async stop() {
    await this.page.getByRole("button", { name: "Stop" }).click()
  }

  /** Toggle stop after current task */
  async toggleStopAfterCurrent() {
    await this.page.getByRole("button", { name: /stop after/i }).click()
  }

  /** Check if the Start button is enabled */
  async isStartEnabled(): Promise<boolean> {
    return this.page.getByRole("button", { name: "Start" }).isEnabled()
  }

  /** Check if the Pause button is enabled */
  async isPauseEnabled(): Promise<boolean> {
    return this.page.getByRole("button", { name: "Pause" }).isEnabled()
  }

  /** Check if the Stop button is enabled */
  async isStopEnabled(): Promise<boolean> {
    return this.page.getByRole("button", { name: "Stop" }).isEnabled()
  }

  /** Get any error message displayed in the control bar */
  async getError(): Promise<string | null> {
    const errorElement = this.page.locator('[class*="control-bar-error"]')
    if (await errorElement.isVisible()) {
      return errorElement.textContent()
    }
    return null
  }
}

/**  Page object for the command palette */
export class CommandPalettePage {
  readonly page: Page
  readonly container: Locator
  readonly input: Locator

  constructor(page: Page) {
    this.page = page
    this.container = page.locator('[data-testid="command-palette"]')
    this.input = page.locator('[data-testid="command-input"]')
  }

  /** Open the command palette */
  async open() {
    await this.page.keyboard.press("Meta+k")
    await expect(this.container).toBeVisible()
  }

  /** Close the command palette */
  async close() {
    await this.page.keyboard.press("Escape")
    await expect(this.container).not.toBeVisible()
  }

  /** Search for a command */
  async search(query: string) {
    await this.input.fill(query)
  }

  /** Execute a command by name */
  async executeCommand(commandName: string) {
    await this.search(commandName)
    await this.page.getByRole("option", { name: new RegExp(commandName, "i") }).click()
  }

  /** Check if the command palette is open */
  async isOpen(): Promise<boolean> {
    return this.container.isVisible()
  }
}

/**  Page object for the header (workspace picker, theme toggle, etc.) */
export class HeaderPage {
  readonly page: Page
  readonly header: Locator

  constructor(page: Page) {
    this.page = page
    this.header = page.locator('[data-testid="header"]')
  }

  /** Toggle the theme */
  async toggleTheme() {
    await this.page.locator('[data-testid="theme-toggle"]').click()
  }

  /** Open the workspace picker */
  async openWorkspacePicker() {
    await this.header.getByRole("combobox").click()
  }

  /** Select a workspace by name */
  async selectWorkspace(workspaceName: string) {
    await this.openWorkspacePicker()
    await this.page.getByRole("option", { name: workspaceName }).click()
  }
}

/**  Page object for the status bar */
export class StatusBarPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** Get the token usage from the status bar */
  async getTokenUsage(): Promise<{ displayed: string } | null> {
    const tokenElement = this.page.locator('[data-testid="context-window-progress"]')
    if (!(await tokenElement.isVisible())) {
      return null
    }
    return { displayed: (await tokenElement.textContent()) ?? "" }
  }

  /** Get the Ralph connection status */
  async getConnectionStatus(): Promise<string> {
    const statusElement = this.page.locator('[class*="status-indicator"]')
    return (await statusElement.getAttribute("class")) ?? ""
  }
}

/**  Page object for the iteration history sheet/panel */
export class IterationHistoryPage {
  readonly page: Page
  readonly triggerButton: Locator
  readonly sheet: Locator
  readonly searchInput: Locator
  readonly clearSearchButton: Locator
  readonly historyList: Locator

  constructor(page: Page) {
    this.page = page
    // The sheet trigger is in the sidebar, scope to the complementary region to avoid the dropdown in the event stream
    const sidebar = page.getByRole("complementary", { name: "Task sidebar" })
    this.triggerButton = sidebar.getByRole("button", { name: "View iteration history" })
    this.sheet = page.locator('[role="dialog"]').filter({ hasText: "Iteration History" })
    this.searchInput = this.sheet.getByRole("textbox", { name: "Search iterations" })
    this.clearSearchButton = this.sheet.getByRole("button", { name: "Clear search" })
    this.historyList = this.sheet.getByRole("list", { name: "Iteration history" })
  }

  /** Open the iteration history sheet */
  async open() {
    await this.triggerButton.click()
    await expect(this.sheet).toBeVisible()
  }

  /** Close the iteration history sheet */
  async close() {
    await this.page.keyboard.press("Escape")
    await expect(this.sheet).not.toBeVisible()
  }

  /** Check if the sheet is open */
  async isOpen(): Promise<boolean> {
    return this.sheet.isVisible()
  }

  /** Search for iterations by query */
  async search(query: string) {
    await this.searchInput.fill(query)
  }

  /** Clear the search input */
  async clearSearch() {
    await this.clearSearchButton.click()
  }

  /** Get the number of visible iteration items */
  async getVisibleIterationCount(): Promise<number> {
    const items = this.historyList.locator("li")
    return items.count()
  }

  /** Get all date group labels */
  async getDateGroupLabels(): Promise<string[]> {
    const groups = this.sheet.locator('[role="group"]')
    const count = await groups.count()
    const labels: string[] = []
    for (let i = 0; i < count; i++) {
      const label = await groups.nth(i).getAttribute("aria-label")
      if (label) {
        // Extract date from "Iterations from <date>"
        const match = label.match(/Iterations from (.+)/)
        if (match) {
          labels.push(match[1])
        }
      }
    }
    return labels
  }

  /** Click on an iteration by its task ID */
  async clickIterationByTaskId(taskId: string) {
    await this.historyList.locator("li").filter({ hasText: taskId }).click()
  }

  /** Get the header text showing the total count */
  async getHeaderCount(): Promise<number | null> {
    const header = this.sheet.locator("text=/\\(\\d+\\)/")
    const text = await header.textContent()
    const match = text?.match(/\((\d+)\)/)
    return match ? parseInt(match[1], 10) : null
  }

  /** Check if the empty state is shown */
  async isEmptyStateVisible(): Promise<boolean> {
    const emptyText = this.sheet.getByText("No iteration history yet.")
    return emptyText.isVisible()
  }

  /** Check if the "no results" state is shown */
  async isNoResultsVisible(): Promise<boolean> {
    const noResults = this.sheet.getByText("No matching iterations found.")
    return noResults.isVisible()
  }
}

/**  Main application page object that combines all page objects */
export class AppPage {
  readonly page: Page
  readonly taskList: TaskListPage
  readonly taskDetails: TaskDetailsPage
  readonly chat: ChatPanelPage
  readonly eventStream: EventStreamPage
  readonly controlBar: ControlBarPage
  readonly commandPalette: CommandPalettePage
  readonly header: HeaderPage
  readonly statusBar: StatusBarPage
  readonly iterationHistory: IterationHistoryPage

  constructor(page: Page) {
    this.page = page
    this.taskList = new TaskListPage(page)
    this.taskDetails = new TaskDetailsPage(page)
    this.chat = new ChatPanelPage(page)
    this.eventStream = new EventStreamPage(page)
    this.controlBar = new ControlBarPage(page)
    this.commandPalette = new CommandPalettePage(page)
    this.header = new HeaderPage(page)
    this.statusBar = new StatusBarPage(page)
    this.iterationHistory = new IterationHistoryPage(page)
  }

  /** Navigate to the app */
  async goto() {
    await this.page.goto("/")
  }

  /** Toggle the sidebar visibility */
  async toggleSidebar() {
    await this.page.keyboard.press("Meta+b")
  }

  /** Check if the sidebar is visible */
  async isSidebarVisible(): Promise<boolean> {
    return this.taskList.sidebar.isVisible()
  }

  /** Open the hotkeys dialog */
  async openHotkeysDialog() {
    await this.page.keyboard.press("Shift+?")
  }

  /** Wait for the app to be fully loaded */
  async waitForLoad() {
    // Wait for the main layout elements to be visible
    await expect(this.taskList.sidebar).toBeVisible()
    await expect(this.eventStream.container).toBeVisible()
    await expect(this.chat.messageInput).toBeVisible()
  }

  /** Focus the chat input */
  async focusChat() {
    await this.page.keyboard.press("c")
  }

  /** Focus the task search */
  async focusTaskSearch() {
    await this.page.keyboard.press("Meta+f")
  }
}

/**  Extended test fixture that includes the AppPage */
export const test = base.extend<{ app: AppPage }>({
  app: async ({ page }, use) => {
    const app = new AppPage(page)
    await app.goto()
    await app.waitForLoad()
    await use(app)
  },
})

export { expect }
