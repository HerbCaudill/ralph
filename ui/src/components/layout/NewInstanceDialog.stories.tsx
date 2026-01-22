import type { Meta, StoryObj } from "@storybook/react"
import { NewInstanceDialog } from "./NewInstanceDialog"
import { useAppStore } from "@/store"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const meta: Meta<typeof NewInstanceDialog> = {
  title: "Layout/NewInstanceDialog",
  component: NewInstanceDialog,
  parameters: {
    layout: "centered",
  },
  decorators: [
    Story => {
      // Reset store before each story
      useEffect(() => {
        useAppStore.getState().reset()
      }, [])
      return <Story />
    },
  ],
}

export default meta
type Story = StoryObj<typeof NewInstanceDialog>

// Interactive wrapper that manages dialog state
function DialogWrapper({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="flex flex-col items-center gap-4">
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>
      <NewInstanceDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

export const Default: Story = {
  render: () => <DialogWrapper defaultOpen={true} />,
}

export const Closed: Story = {
  render: () => <DialogWrapper defaultOpen={false} />,
}
