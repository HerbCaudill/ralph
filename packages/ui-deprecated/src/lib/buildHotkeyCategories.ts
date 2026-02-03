import { hotkeys, type HotkeyAction, type HotkeyConfig } from "@/config"
import type { HotkeyCategory } from "@/types"

export function buildHotkeyCategories(): HotkeyCategory[] {
  const categoryMap = new Map<string, Array<{ action: HotkeyAction; config: HotkeyConfig }>>()
  const categoryOrder: string[] = []

  Object.entries(hotkeys).forEach(([action, config]) => {
    const category = config.category
    if (!categoryMap.has(category)) {
      categoryMap.set(category, [])
      categoryOrder.push(category)
    }
    categoryMap.get(category)!.push({
      action: action as HotkeyAction,
      config,
    })
  })

  return categoryOrder.map(name => ({
    name,
    hotkeys: categoryMap.get(name)!,
  }))
}
