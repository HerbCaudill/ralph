# Task Completion Checklist

After completing any coding task, do the following:

1. **Compile & run** — Make sure everything compiles (`pnpm typecheck`)
2. **Run unit tests** — `pnpm test:all` or `pnpm test:changed`
3. **Run Playwright tests** if applicable — `pnpm test:pw`
4. **Format code** — `pnpm format`
5. **Commit** — Commit immediately; use intermediate commits for large changes
   - Prefix commit messages with primary class/function/component name
   - Example: `EditTemplatePage: refactor data source handling`
6. **Update docs** — Update CLAUDE.md if architecture or commands changed
7. **Beads sync** — `bd sync` to push issue tracker state
