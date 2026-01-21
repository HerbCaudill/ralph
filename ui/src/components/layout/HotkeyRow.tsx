import type { HotkeyAction, HotkeyConfig } from "@/config"
import { getHotkeyDisplayString } from "@/lib/getHotkeyDisplayString"

export function HotkeyRow({ config }: Props) {
  const display = getHotkeyDisplayString(config)

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-foreground text-sm">{config.description}</span>
      <kbd className="bg-muted text-muted-foreground border-border ml-4 shrink-0 rounded border px-2 py-1 font-sans text-sm tracking-widest">
        {display}
      </kbd>
    </div>
  )
}

type Props = {
  action: HotkeyAction
  config: HotkeyConfig
}
