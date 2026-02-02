import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { WorkspaceSelector } from ".././WorkspaceSelector"
import type { Workspace } from "../../hooks/useWorkspace"

const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  path: "/home/user/project",
  name: "My Project",
  ...overrides,
})

describe("WorkspaceSelector", () => {
  describe("rendering", () => {
    it("shows the current workspace name", () => {
      render(
        <WorkspaceSelector
          current={makeWorkspace({ name: "Alpha" })}
          workspaces={[]}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      expect(screen.getByText("Alpha")).toBeInTheDocument()
    })

    it("shows 'No workspace' when current is null", () => {
      render(
        <WorkspaceSelector current={null} workspaces={[]} isLoading={false} onSwitch={() => {}} />,
      )
      expect(screen.getByText("No workspace")).toBeInTheDocument()
    })

    it("falls back to issuePrefix when name is missing", () => {
      render(
        <WorkspaceSelector
          current={makeWorkspace({ name: undefined as unknown as string, issuePrefix: "PROJ" })}
          workspaces={[]}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      expect(screen.getByText("PROJ")).toBeInTheDocument()
    })

    it("shows the branch name in parentheses when present", () => {
      render(
        <WorkspaceSelector
          current={makeWorkspace({ branch: "feature/foo" })}
          workspaces={[]}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      expect(screen.getByText("(feature/foo)")).toBeInTheDocument()
    })

    it("does not show branch when not present", () => {
      render(
        <WorkspaceSelector
          current={makeWorkspace({ branch: undefined })}
          workspaces={[]}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      expect(screen.queryByText(/\(/)).not.toBeInTheDocument()
    })
  })

  describe("loading state", () => {
    it("renders the spinner icon when loading", () => {
      const { container } = render(
        <WorkspaceSelector current={null} workspaces={[]} isLoading={true} onSwitch={() => {}} />,
      )
      const spinner = container.querySelector(".animate-spin")
      expect(spinner).toBeInTheDocument()
    })

    it("does not show spinner when not loading", () => {
      const { container } = render(
        <WorkspaceSelector
          current={makeWorkspace()}
          workspaces={[]}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      const spinner = container.querySelector(".animate-spin")
      expect(spinner).not.toBeInTheDocument()
    })
  })

  describe("dropdown interaction", () => {
    const workspaces: Workspace[] = [
      makeWorkspace({ path: "/a", name: "Alpha", issueCount: 3 }),
      makeWorkspace({ path: "/b", name: "Beta", issueCount: 7 }),
      makeWorkspace({ path: "/c", name: "Gamma" }),
    ]

    it("does not show the dropdown initially", () => {
      render(
        <WorkspaceSelector
          current={workspaces[0]}
          workspaces={workspaces}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      expect(screen.queryByText("Workspaces")).not.toBeInTheDocument()
    })

    it("opens the dropdown when the button is clicked", () => {
      render(
        <WorkspaceSelector
          current={workspaces[0]}
          workspaces={workspaces}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      fireEvent.click(screen.getByText("Alpha"))
      expect(screen.getByText("Workspaces")).toBeInTheDocument()
      expect(screen.getByText("Beta")).toBeInTheDocument()
      expect(screen.getByText("Gamma")).toBeInTheDocument()
    })

    it("shows issue counts for workspaces that have them", () => {
      render(
        <WorkspaceSelector
          current={workspaces[0]}
          workspaces={workspaces}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      fireEvent.click(screen.getByText("Alpha"))
      expect(screen.getByText("3")).toBeInTheDocument()
      expect(screen.getByText("7")).toBeInTheDocument()
    })

    it("calls onSwitch with the workspace path when a different workspace is clicked", () => {
      const handleSwitch = vi.fn()
      render(
        <WorkspaceSelector
          current={workspaces[0]}
          workspaces={workspaces}
          isLoading={false}
          onSwitch={handleSwitch}
        />,
      )
      fireEvent.click(screen.getByText("Alpha"))
      fireEvent.click(screen.getByText("Beta"))
      expect(handleSwitch).toHaveBeenCalledWith("/b")
    })

    it("does not call onSwitch when clicking the current workspace", () => {
      const handleSwitch = vi.fn()
      render(
        <WorkspaceSelector
          current={workspaces[0]}
          workspaces={workspaces}
          isLoading={false}
          onSwitch={handleSwitch}
        />,
      )
      // Open dropdown
      fireEvent.click(screen.getByText("Alpha"))
      // In the dropdown, "Alpha" appears both in the trigger and in the list.
      // The list item for Alpha will have font-medium class (current).
      const dropdownItems = screen.getAllByText("Alpha")
      // Click the dropdown item (last one)
      fireEvent.click(dropdownItems[dropdownItems.length - 1])
      expect(handleSwitch).not.toHaveBeenCalled()
    })

    it("closes the dropdown after selecting a workspace", () => {
      render(
        <WorkspaceSelector
          current={workspaces[0]}
          workspaces={workspaces}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      fireEvent.click(screen.getByText("Alpha"))
      expect(screen.getByText("Workspaces")).toBeInTheDocument()
      fireEvent.click(screen.getByText("Beta"))
      expect(screen.queryByText("Workspaces")).not.toBeInTheDocument()
    })

    it("closes the dropdown when the backdrop is clicked", () => {
      const { container } = render(
        <WorkspaceSelector
          current={workspaces[0]}
          workspaces={workspaces}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      fireEvent.click(screen.getByText("Alpha"))
      expect(screen.getByText("Workspaces")).toBeInTheDocument()
      // The backdrop is a fixed inset-0 div
      const backdrop = container.querySelector(".fixed.inset-0")
      expect(backdrop).toBeInTheDocument()
      fireEvent.click(backdrop!)
      expect(screen.queryByText("Workspaces")).not.toBeInTheDocument()
    })

    it("does not open the dropdown when there are no workspaces", () => {
      render(
        <WorkspaceSelector
          current={makeWorkspace()}
          workspaces={[]}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      fireEvent.click(screen.getByText("My Project"))
      expect(screen.queryByText("Workspaces")).not.toBeInTheDocument()
    })
  })

  describe("current workspace indicator", () => {
    it("applies font-medium to the current workspace item", () => {
      const workspaces: Workspace[] = [
        makeWorkspace({ path: "/a", name: "Alpha" }),
        makeWorkspace({ path: "/b", name: "Beta" }),
      ]
      render(
        <WorkspaceSelector
          current={workspaces[0]}
          workspaces={workspaces}
          isLoading={false}
          onSwitch={() => {}}
        />,
      )
      fireEvent.click(screen.getByText("Alpha"))
      // Find dropdown items by role or text - the current one should have font-medium
      const dropdownAlphas = screen.getAllByText("Alpha")
      const dropdownItem = dropdownAlphas[dropdownAlphas.length - 1].closest("button")
      expect(dropdownItem).toHaveClass("font-medium")
    })
  })
})
