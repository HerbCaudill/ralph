import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { HeaderRepoBranch } from "../HeaderRepoBranch"

describe("HeaderRepoBranch", () => {
  it("renders workspace name and branch when both provided", () => {
    render(
      <HeaderRepoBranch
        workspaceName="ralph"
        branch="main"
        workspacePath="/code/ralph"
        textColor="#ffffff"
      />,
    )

    const container = screen.getByTestId("header-repo-branch")
    expect(container).toBeInTheDocument()
    expect(container).toHaveTextContent("ralph")
    expect(container).toHaveTextContent("main")
  })

  it("renders only workspace name when branch is null", () => {
    render(
      <HeaderRepoBranch
        workspaceName="ralph"
        branch={null}
        workspacePath="/code/ralph"
        textColor="#ffffff"
      />,
    )

    expect(screen.getByText("ralph")).toBeInTheDocument()
    expect(screen.queryByText("/")).not.toBeInTheDocument()
  })

  it("renders only branch when workspace name is null", () => {
    render(
      <HeaderRepoBranch
        workspaceName={null}
        branch="feature"
        workspacePath={null}
        textColor="#ffffff"
      />,
    )

    expect(screen.getByText("feature")).toBeInTheDocument()
  })

  it("returns null when both workspace name and branch are null", () => {
    const { container } = render(
      <HeaderRepoBranch
        workspaceName={null}
        branch={null}
        workspacePath={null}
        textColor="#ffffff"
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("applies the text color style", () => {
    render(
      <HeaderRepoBranch
        workspaceName="ralph"
        branch="main"
        workspacePath="/code/ralph"
        textColor="#ff0000"
      />,
    )

    const container = screen.getByTestId("header-repo-branch")
    expect(container).toHaveStyle({ color: "#ff0000" })
  })

  it("shows workspace path in title tooltip", () => {
    render(
      <HeaderRepoBranch
        workspaceName="ralph"
        branch="main"
        workspacePath="/Users/herb/Code/ralph"
        textColor="#ffffff"
      />,
    )

    const container = screen.getByTestId("header-repo-branch")
    expect(container).toHaveAttribute("title", "/Users/herb/Code/ralph")
  })

  it("renders with correct opacity for muted appearance", () => {
    render(
      <HeaderRepoBranch
        workspaceName="ralph"
        branch="main"
        workspacePath="/code/ralph"
        textColor="#000000"
      />,
    )

    const container = screen.getByTestId("header-repo-branch")
    expect(container).toHaveClass("opacity-80")
  })
})
