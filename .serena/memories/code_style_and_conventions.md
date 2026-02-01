# Code Style & Conventions

## Prettier Config
- No semicolons (`semi: false`)
- Double quotes (`singleQuote: false`)
- 2-space indentation, no tabs
- Trailing commas everywhere
- Arrow parens: avoid when possible
- Print width: 100
- Experimental ternaries enabled

## TypeScript
- Strict mode, ES modules (`"type": "module"`)
- Named exports only (no default exports unless framework requires it)
- Each function in its own file
- Shared types in `types.ts`, constants in `constants.ts`

## React Components
- One component per file
- Component definition first (after imports), Props type at end of file
- Helper functions in separate files under `lib/`
- Controller/presentational pattern: `FooController` (hooks) + `Foo` (pure props)
- Use `cx()` (clsx) for combining Tailwind classes, not string interpolation

## Comments
- Every function/class/method preceded by `/** ... */` block comment
- Function params documented independently (not jsdoc @param)
- Keep to single line if possible
- No ASCII art borders in comments

## Testing
- Vitest for unit tests, Playwright for E2E
- Test files named `foo.test.ts`
- TDD for new non-trivial functions
- Playwright selectors: visible text, accessible roles, labels, placeholders

## Functional Style
- Prefer pure functions, immutable data
- `map`/`filter`/`reduce` for simple transforms; loops when clearer
- Side effects at the edges

## UI Conventions
- Tabler icons, IBM Plex fonts
- Sentence case for button text, headings, labels
- Storybook stories test presentational components directly
