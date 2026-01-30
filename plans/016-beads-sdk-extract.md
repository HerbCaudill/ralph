# Move beads to its own repo as `@herbcaudill/beads-sdk`

## 1. Create the new repo

- Create `~/Code/HerbCaudill/beads-sdk/` with `git init`
- Copy `packages/beads/src/` → `src/`
- Copy `packages/beads/tsconfig.json`
- Update `package.json`: rename to `@herbcaudill/beads-sdk`, update repo URL to `HerbCaudill/beads-sdk`
- Add `.gitignore`, `.prettierrc`
- `pnpm install && pnpm build`
- Create GitHub repo, initial commit, push
- `pnpm publish` (or `npm publish`) to make it available

## 2. Update ralph monorepo

**Delete** `packages/beads/`

**Update package.json dependencies** (3 files):
- `packages/cli/package.json` — `@herbcaudill/beads@workspace:*` → `@herbcaudill/beads-sdk@^0.1.0`
- `packages/ui/package.json` — same
- `packages/shared/package.json` — same (devDep)

**Update imports** (7 files):
- `packages/cli/src/lib/beadsClient.ts`
- `packages/ui/server/BdProxy.ts`
- `packages/ui/server/BeadsClient.ts`
- `packages/ui/server/BeadsClient.test.ts`
- `packages/ui/server/WorkspaceContext.ts`
- `packages/ui/server/WorkspaceContext.test.ts`

All are simple find-replace: `@herbcaudill/beads` → `@herbcaudill/beads-sdk`

**Update CLAUDE.md** — change beads import references

**Run** `pnpm install` to update lockfile

## 3. Verify

- `pnpm typecheck` in ralph
- `pnpm test:all` in ralph
- `pnpm format` in ralph

## 4. Commit & push

- Commit ralph changes
- Push both repos
