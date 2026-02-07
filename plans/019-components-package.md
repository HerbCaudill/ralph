# Plan: `@herbcaudill/components` package

## Goal

Extract all shadcn/ui primitives into a standalone `packages/components/` package. Update `beads-view` and `ui` to consume from it. Write stories for every component.

## Components to include

From `packages/ui/src/components/ui/` (superset — has everything beads-view has plus more):

| Component | File | Radix/lib dependency |
|---|---|---|
| Button | button.tsx | `@radix-ui/react-slot`, CVA |
| ButtonGroup | button-group.tsx | CVA (uses Separator) |
| Command | command.tsx | `cmdk` |
| Dialog | dialog.tsx | `@radix-ui/react-dialog` |
| HoverCard | hover-card.tsx | `@radix-ui/react-hover-card` |
| Input | input.tsx | — |
| InputGroup | input-group.tsx | CVA (uses Button, Input, Textarea) |
| Label | label.tsx | `@radix-ui/react-label`, CVA |
| Popover | popover.tsx | `@radix-ui/react-popover` |
| Select | select.tsx | `@radix-ui/react-select` |
| Separator | separator.tsx | `@radix-ui/react-separator` |
| Sheet | sheet.tsx | `@radix-ui/react-dialog`, CVA |
| Textarea | textarea.tsx | — |
| Tooltip | tooltip.tsx | `@radix-ui/react-tooltip` |

From `packages/beads-view/src/components/ui/`:

| Component | File | Notes |
|---|---|---|
| ResponsiveButtonGroup | responsive-button-group.tsx | Uses ButtonGroup |

Plus the `cn` utility.

The beads-view copies are identical to ui copies (confirmed by reading both button.tsx files). The only unique beads-view component is `ResponsiveButtonGroup`.

## Package structure

```
packages/components/
  package.json
  tsconfig.json
  .storybook/
    main.ts
    preview.ts
    app.css
  src/
    index.ts              # barrel export
    lib/
      cn.ts               # cn utility
    components/
      button.tsx
      button-group.tsx
      command.tsx
      dialog.tsx
      hover-card.tsx
      input.tsx
      input-group.tsx
      label.tsx
      popover.tsx
      responsive-button-group.tsx
      select.tsx
      separator.tsx
      sheet.tsx
      textarea.tsx
      tooltip.tsx
    stories/
      Button.stories.tsx
      ButtonGroup.stories.tsx
      Command.stories.tsx
      Dialog.stories.tsx
      HoverCard.stories.tsx
      Input.stories.tsx
      InputGroup.stories.tsx
      Label.stories.tsx
      Popover.stories.tsx
      ResponsiveButtonGroup.stories.tsx
      Select.stories.tsx
      Separator.stories.tsx
      Sheet.stories.tsx
      Textarea.stories.tsx
      Tooltip.stories.tsx
```

## Import path changes

Components will use relative imports internally (e.g., `from "./separator"` instead of `from "@/components/ui/separator"`).

## package.json

- Name: `@herbcaudill/components`
- Build: `tsc`
- Exports: `"."` → `dist/index.js`
- Dependencies: all Radix primitives, CVA, clsx, tailwind-merge, cmdk, @tabler/icons-react
- Peer dependencies: react, react-dom
- Dev dependencies: storybook, tailwindcss, @tailwindcss/vite, vitest, typescript

## Migration plan

### Phase 1: Create the package
1. Create `packages/components/` with all config files
2. Copy component files from `packages/ui/src/components/ui/` + `ResponsiveButtonGroup` from beads-view
3. Update internal imports to use relative paths (no `@/` alias)
4. Create `src/index.ts` barrel export
5. Add to `pnpm-workspace.yaml`
6. `pnpm install` to link

### Phase 2: Write stories
7. Create `.storybook/` config (same pattern as agent-view, port 6009)
8. Write stories for all 15 components

### Phase 3: Update consumers
9. Add `@herbcaudill/components` as dependency to `beads-view` and `ui`
10. Update `beads-view` imports: `from "../ui/button"` → `from "@herbcaudill/components"`
11. Update `ui` imports: `from "@/components/ui/button"` → `from "@herbcaudill/components"`
12. Delete `packages/beads-view/src/components/ui/` directory
13. Delete `packages/ui/src/components/ui/` directory
14. Remove now-unused Radix/CVA/cmdk direct dependencies from beads-view and ui package.json files

### Phase 4: Verify
15. `pnpm build` — ensure all packages compile
16. `pnpm typecheck` — no type errors
17. `pnpm test:all` — all tests pass
18. `pnpm format`
19. Commit

## Unresolved questions

None — the components are identical across packages and the extraction is straightforward.
