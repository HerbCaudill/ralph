# Suggested Commands

## Development

| Command                            | Description                                   |
| ---------------------------------- | --------------------------------------------- |
| `pnpm build`                       | Build all packages                            |
| `pnpm --filter ralph-shared build` | Build shared package (required after changes) |
| `pnpm typecheck`                   | Typecheck all packages                        |
| `pnpm cli`                         | Run Ralph CLI in development                  |
| `pnpm ui`                          | Start UI dev server (Vite)                    |
| `pnpm serve`                       | Start server only                             |
| `pnpm dev`                         | Start both server and UI                      |
| `pnpm storybook`                   | Start Storybook                               |

## Testing

| Command                | Description                |
| ---------------------- | -------------------------- |
| `pnpm test`            | Run all tests (CLI + UI)   |
| `pnpm test:unit`       | All unit tests             |
| `pnpm test:unit:{pkg}` | Unit tests for one package |
| `pnpm test:pw`         | Playwright E2E tests       |

## Formatting & Quality

| Command       | Description                        |
| ------------- | ---------------------------------- |
| `pnpm format` | Format changed files with Prettier |

## Publishing

| Command    | Description               |
| ---------- | ------------------------- |
| `pnpm pub` | Publish CLI + UI packages |

## System Utilities (macOS/Darwin)

Standard unix commands: `git`, `ls`, `cd`, `grep`, `find`, `cat`, `mkdir`, `rm`, etc.
