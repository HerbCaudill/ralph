import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../components/sheet"
import { Button } from "../components/button"
import { Input } from "../components/input"
import { Label } from "../components/label"

const meta = {
  title: "Sheet",
  component: Sheet,
} satisfies Meta<typeof Sheet>

export default meta
type Story = StoryObj<typeof meta>

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>Make changes to your profile here.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 p-6">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Name</Label>
            <Input className="col-span-3" defaultValue="Herb" />
          </div>
        </div>
        <SheetFooter>
          <Button>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
}

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open left</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <div className="p-6">
          <nav className="space-y-2">
            <div className="text-sm">Dashboard</div>
            <div className="text-sm">Settings</div>
            <div className="text-sm">Help</div>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  ),
}

export const Bottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open bottom</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Bottom sheet</SheetTitle>
          <SheetDescription>This slides up from the bottom.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
}
