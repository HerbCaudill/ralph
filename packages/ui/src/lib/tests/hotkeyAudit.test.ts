import { describe, it, expect } from "vitest"
import { hotkeys as agentHotkeys, type AgentHotkeyAction } from "@herbcaudill/agent-view"
import {
  hotkeys as beadsHotkeys,
  type BeadsHotkeyAction,
  type HotkeyConfig,
} from "@herbcaudill/beads-view"

/**
 * Serialize a hotkey config to a comparable string for conflict detection.
 * Sorts modifiers to make the comparison order-independent.
 */
function serializeBinding(config: HotkeyConfig): string {
  const mods = [...config.modifiers].sort().join("+")
  const key = config.key.toLowerCase()
  return mods ? `${mods}+${key}` : key
}

describe("cross-package hotkey audit", () => {
  describe("no duplicate key bindings within agent-view", () => {
    it("all agent-view hotkeys have unique key bindings", () => {
      const seen = new Map<string, string>()
      for (const [action, config] of Object.entries(agentHotkeys)) {
        const binding = serializeBinding(config as HotkeyConfig)
        expect(seen.has(binding), `Duplicate binding "${binding}": "${action}" conflicts with "${seen.get(binding)}"`).toBe(false)
        seen.set(binding, action)
      }
    })
  })

  describe("no duplicate key bindings within beads-view", () => {
    it("all beads-view hotkeys have unique key bindings", () => {
      const seen = new Map<string, string>()
      for (const [action, config] of Object.entries(beadsHotkeys)) {
        const binding = serializeBinding(config as HotkeyConfig)
        expect(seen.has(binding), `Duplicate binding "${binding}": "${action}" conflicts with "${seen.get(binding)}"`).toBe(false)
        seen.set(binding, action)
      }
    })
  })

  describe("cross-package conflicts", () => {
    it("shared bindings only exist for the same logical action (showHotkeys)", () => {
      const agentBindings = new Map<string, string>()
      for (const [action, config] of Object.entries(agentHotkeys)) {
        agentBindings.set(serializeBinding(config as HotkeyConfig), action)
      }

      const conflicts: string[] = []
      for (const [action, config] of Object.entries(beadsHotkeys)) {
        const binding = serializeBinding(config as HotkeyConfig)
        const agentAction = agentBindings.get(binding)
        if (agentAction && agentAction !== action) {
          conflicts.push(
            `Binding "${binding}": agent-view "${agentAction}" conflicts with beads-view "${action}"`,
          )
        }
      }

      expect(conflicts).toEqual([])
    })

    it("showHotkeys is the only shared binding between packages", () => {
      const agentBindings = new Map<string, string>()
      for (const [action, config] of Object.entries(agentHotkeys)) {
        agentBindings.set(serializeBinding(config as HotkeyConfig), action)
      }

      const shared: string[] = []
      for (const [action, config] of Object.entries(beadsHotkeys)) {
        const binding = serializeBinding(config as HotkeyConfig)
        if (agentBindings.has(binding)) {
          shared.push(action)
        }
      }

      expect(shared).toEqual(["showHotkeys"])
    })
  })

  describe("action completeness", () => {
    const expectedAgentActions: AgentHotkeyAction[] = [
      "focusChatInput",
      "newSession",
      "toggleToolOutput",
      "scrollToBottom",
      "showHotkeys",
    ]

    const expectedBeadsActions: BeadsHotkeyAction[] = [
      "focusSearch",
      "focusTaskInput",
      "previousTask",
      "nextTask",
      "openTask",
      "showHotkeys",
    ]

    it("agent-view defines all expected actions", () => {
      const actions = Object.keys(agentHotkeys)
      for (const expected of expectedAgentActions) {
        expect(actions).toContain(expected)
      }
      expect(actions).toHaveLength(expectedAgentActions.length)
    })

    it("beads-view defines all expected actions", () => {
      const actions = Object.keys(beadsHotkeys)
      for (const expected of expectedBeadsActions) {
        expect(actions).toContain(expected)
      }
      expect(actions).toHaveLength(expectedBeadsActions.length)
    })
  })

  describe("config integrity", () => {
    it("all agent-view actions have non-empty key and description", () => {
      for (const [action, config] of Object.entries(agentHotkeys)) {
        const c = config as HotkeyConfig
        expect(c.key.length, `${action} has empty key`).toBeGreaterThan(0)
        expect(c.description.length, `${action} has empty description`).toBeGreaterThan(0)
        expect(c.category.length, `${action} has empty category`).toBeGreaterThan(0)
      }
    })

    it("all beads-view actions have non-empty key and description", () => {
      for (const [action, config] of Object.entries(beadsHotkeys)) {
        const c = config as HotkeyConfig
        expect(c.key.length, `${action} has empty key`).toBeGreaterThan(0)
        expect(c.description.length, `${action} has empty description`).toBeGreaterThan(0)
        expect(c.category.length, `${action} has empty category`).toBeGreaterThan(0)
      }
    })

    it("modifiers only contain valid values", () => {
      const validModifiers = new Set(["cmd", "ctrl", "alt", "shift"])

      for (const [action, config] of Object.entries(agentHotkeys)) {
        for (const mod of (config as HotkeyConfig).modifiers) {
          expect(validModifiers.has(mod), `agent-view "${action}" has invalid modifier "${mod}"`).toBe(true)
        }
      }

      for (const [action, config] of Object.entries(beadsHotkeys)) {
        for (const mod of (config as HotkeyConfig).modifiers) {
          expect(validModifiers.has(mod), `beads-view "${action}" has invalid modifier "${mod}"`).toBe(true)
        }
      }
    })
  })

  describe("HotkeysDialog deduplication", () => {
    it("showHotkeys appears in both packages with the same binding", () => {
      const agentShowHotkeys = agentHotkeys.showHotkeys
      const beadsShowHotkeys = beadsHotkeys.showHotkeys

      expect(serializeBinding(agentShowHotkeys)).toBe(serializeBinding(beadsShowHotkeys))
    })

    it("deduplication logic filters beads entries that exist in agent-view", () => {
      /** Simulates the deduplication logic from HotkeysDialog.tsx */
      const agentActionNames = new Set(Object.keys(agentHotkeys))
      const deduplicatedBeadsEntries = Object.entries(beadsHotkeys).filter(
        ([action]) => !agentActionNames.has(action),
      )

      // showHotkeys should be filtered out
      const deduplicatedActions = deduplicatedBeadsEntries.map(([action]) => action)
      expect(deduplicatedActions).not.toContain("showHotkeys")

      // Other beads actions should remain
      expect(deduplicatedActions).toContain("focusSearch")
      expect(deduplicatedActions).toContain("focusTaskInput")
      expect(deduplicatedActions).toContain("previousTask")
      expect(deduplicatedActions).toContain("nextTask")
      expect(deduplicatedActions).toContain("openTask")

      // Total unique entries should be agent(5) + beads(5, minus showHotkeys) = 10
      const totalEntries = Object.keys(agentHotkeys).length + deduplicatedBeadsEntries.length
      expect(totalEntries).toBe(10)
    })
  })
})
