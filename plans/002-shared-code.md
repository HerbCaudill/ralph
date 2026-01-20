# Shared CLI/Server Code

## Goal

Reduce duplication between CLI and server by extracting shared types/utilities that are currently maintained in parallel.

## Approach

Create a new workspace package for shared code and migrate the highest-value overlaps: agent event normalization/types, beads domain types, and prompt-loading helpers. Update CLI and server to depend on the shared package, then document the new layout.

Shared package will be internal-only (workspace private).

## Tasks

1. Add a shared workspace package and wiring (pnpm workspace, tsconfig/build exports).
2. Move agent event types + normalization helpers into shared module; update CLI and server usage.
3. Move beads domain types (issues, statuses, mutation events) into shared module; update CLI and server usage.
4. Add a shared prompt loader utility; update CLI and server prompt loading to use it.
5. Update docs (README/CLAUDE) to mention the shared package and conventions.
