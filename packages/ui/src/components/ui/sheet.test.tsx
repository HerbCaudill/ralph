import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "./sheet"
import { Button } from "./button"

describe("Sheet", () => {
  describe("basic rendering", () => {
    it("renders sheet content when open", async () => {
      render(
        <Sheet>
          <SheetTrigger asChild>
            <Button>Open Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet Title</SheetTitle>
              <SheetDescription>Sheet description text</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>,
      )

      // Sheet should not be visible initially
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

      // Click the trigger to open
      fireEvent.click(screen.getByRole("button", { name: "Open Sheet" }))

      // Sheet should be visible
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      // Title and description should be visible
      expect(screen.getByText("Sheet Title")).toBeInTheDocument()
      expect(screen.getByText("Sheet description text")).toBeInTheDocument()
    })

    it("closes when clicking close button", async () => {
      render(
        <Sheet>
          <SheetTrigger asChild>
            <Button>Open Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>Sheet Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      // Open the sheet
      fireEvent.click(screen.getByRole("button", { name: "Open Sheet" }))

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      // Click the close button (the X button)
      fireEvent.click(screen.getByRole("button", { name: "Close" }))

      // Sheet should close
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      })
    })

    it("closes when pressing Escape", async () => {
      render(
        <Sheet>
          <SheetTrigger asChild>
            <Button>Open Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>Sheet Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      // Open the sheet
      fireEvent.click(screen.getByRole("button", { name: "Open Sheet" }))

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" })

      // Sheet should close
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      })
    })
  })

  describe("controlled mode", () => {
    it("can be controlled externally", async () => {
      const onOpenChange = vi.fn()

      const { rerender } = render(
        <Sheet open={false} onOpenChange={onOpenChange}>
          <SheetContent>
            <SheetTitle>Sheet Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      // Sheet should not be visible
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

      // Rerender with open=true
      rerender(
        <Sheet open={true} onOpenChange={onOpenChange}>
          <SheetContent>
            <SheetTitle>Sheet Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      // Sheet should be visible
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })
    })

    it("calls onOpenChange when closed", async () => {
      const onOpenChange = vi.fn()

      render(
        <Sheet open={true} onOpenChange={onOpenChange}>
          <SheetContent>
            <SheetTitle>Sheet Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      // Click close button
      fireEvent.click(screen.getByRole("button", { name: "Close" }))

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe("side variants", () => {
    it("renders on the right side by default", async () => {
      render(
        <Sheet open={true}>
          <SheetContent data-testid="sheet-content">
            <SheetTitle>Right Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("right-0")
      expect(content).toHaveClass("border-l")
    })

    it("renders on the left side", async () => {
      render(
        <Sheet open={true}>
          <SheetContent side="left" data-testid="sheet-content">
            <SheetTitle>Left Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("left-0")
      expect(content).toHaveClass("border-r")
    })

    it("renders on the top side", async () => {
      render(
        <Sheet open={true}>
          <SheetContent side="top" data-testid="sheet-content">
            <SheetTitle>Top Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("top-0")
      expect(content).toHaveClass("border-b")
    })

    it("renders on the bottom side", async () => {
      render(
        <Sheet open={true}>
          <SheetContent side="bottom" data-testid="sheet-content">
            <SheetTitle>Bottom Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("bottom-0")
      expect(content).toHaveClass("border-t")
    })
  })

  describe("size variants", () => {
    it("renders default size", async () => {
      render(
        <Sheet open={true}>
          <SheetContent data-testid="sheet-content">
            <SheetTitle>Default Size Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("max-w-sm")
    })

    it("renders small size", async () => {
      render(
        <Sheet open={true}>
          <SheetContent size="sm" data-testid="sheet-content">
            <SheetTitle>Small Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("max-w-xs")
    })

    it("renders large size", async () => {
      render(
        <Sheet open={true}>
          <SheetContent size="lg" data-testid="sheet-content">
            <SheetTitle>Large Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("max-w-lg")
    })

    it("renders xl size", async () => {
      render(
        <Sheet open={true}>
          <SheetContent size="xl" data-testid="sheet-content">
            <SheetTitle>XL Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("max-w-xl")
    })

    it("renders full width", async () => {
      render(
        <Sheet open={true}>
          <SheetContent size="full" data-testid="sheet-content">
            <SheetTitle>Full Width Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("w-full")
    })
  })

  describe("SheetHeader", () => {
    it("renders with default styling", () => {
      render(
        <Sheet open={true}>
          <SheetContent>
            <SheetHeader data-testid="sheet-header">
              <SheetTitle>Header Title</SheetTitle>
            </SheetHeader>
          </SheetContent>
        </Sheet>,
      )

      const header = screen.getByTestId("sheet-header")
      expect(header).toHaveClass("flex")
      expect(header).toHaveClass("flex-col")
      expect(header).toHaveClass("p-6")
    })

    it("accepts custom className", () => {
      render(
        <Sheet open={true}>
          <SheetContent>
            <SheetHeader data-testid="sheet-header" className="custom-class">
              <SheetTitle>Header Title</SheetTitle>
            </SheetHeader>
          </SheetContent>
        </Sheet>,
      )

      const header = screen.getByTestId("sheet-header")
      expect(header).toHaveClass("custom-class")
    })
  })

  describe("SheetFooter", () => {
    it("renders with default styling", () => {
      render(
        <Sheet open={true}>
          <SheetContent>
            <SheetTitle>Title</SheetTitle>
            <SheetFooter data-testid="sheet-footer">
              <Button>Save</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>,
      )

      const footer = screen.getByTestId("sheet-footer")
      expect(footer).toHaveClass("flex")
      expect(footer).toHaveClass("p-6")
    })
  })

  describe("SheetTitle", () => {
    it("renders with semantic heading", () => {
      render(
        <Sheet open={true}>
          <SheetContent>
            <SheetTitle>My Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      // Radix renders DialogTitle as h2 by default
      const title = screen.getByText("My Title")
      expect(title.tagName.toLowerCase()).toBe("h2")
      expect(title).toHaveClass("text-lg")
      expect(title).toHaveClass("font-semibold")
    })
  })

  describe("SheetDescription", () => {
    it("renders with muted foreground", () => {
      render(
        <Sheet open={true}>
          <SheetContent>
            <SheetTitle>Title</SheetTitle>
            <SheetDescription>My description</SheetDescription>
          </SheetContent>
        </Sheet>,
      )

      const description = screen.getByText("My description")
      expect(description).toHaveClass("text-muted-foreground")
      expect(description).toHaveClass("text-sm")
    })
  })

  describe("SheetClose", () => {
    it("closes the sheet when clicked", async () => {
      render(
        <Sheet>
          <SheetTrigger asChild>
            <Button>Open</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>Title</SheetTitle>
            <SheetClose asChild>
              <Button>Close Me</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>,
      )

      // Open the sheet
      fireEvent.click(screen.getByRole("button", { name: "Open" }))

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      // Click the custom close button
      fireEvent.click(screen.getByRole("button", { name: "Close Me" }))

      // Sheet should close
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      })
    })
  })

  describe("accessibility", () => {
    it("renders with dialog role", async () => {
      render(
        <Sheet open={true}>
          <SheetContent>
            <SheetTitle>Accessible Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })
    })

    it("has accessible close button", async () => {
      render(
        <Sheet open={true}>
          <SheetContent>
            <SheetTitle>Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      // Close button should have accessible name
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
    })

    it("links title to dialog via aria-labelledby", async () => {
      render(
        <Sheet open={true}>
          <SheetContent>
            <SheetTitle>My Sheet Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveAttribute("aria-labelledby")
    })
  })

  describe("custom className", () => {
    it("allows custom className on SheetContent", async () => {
      render(
        <Sheet open={true}>
          <SheetContent className="custom-content-class" data-testid="sheet-content">
            <SheetTitle>Custom Sheet</SheetTitle>
          </SheetContent>
        </Sheet>,
      )

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
      })

      const content = screen.getByTestId("sheet-content")
      expect(content).toHaveClass("custom-content-class")
    })
  })
})
