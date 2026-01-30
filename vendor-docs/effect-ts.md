# Effect TS quick reference

## The Effect type

```typescript
Effect<Success, Error, Requirements>
```

- **Success (A)**: Value produced on success
- **Error (E)**: Expected (typed) error. `never` = can't fail
- **Requirements (R)**: Dependencies needed. `never` = no dependencies

## Creating effects

```typescript
import { Effect } from "effect"

// From known values
Effect.succeed(42)
Effect.fail(new Error("boom"))

// Lazy (deferred evaluation)
Effect.sync(() => Math.random())
Effect.try(() => JSON.parse(input))

// From promises
Effect.promise(() => fetch(url))
Effect.tryPromise({
  try: () => fetch(url),
  catch: (e) => new FetchError(e)
})

// Async with cancellation
Effect.async<string, Error>((resume) => {
  const controller = new AbortController()
  fetch(url, { signal: controller.signal })
    .then((res) => res.text())
    .then((text) => resume(Effect.succeed(text)))
    .catch((err) => resume(Effect.fail(new Error(String(err)))))
  return Effect.sync(() => controller.abort())
})
```

## Running effects

```typescript
Effect.runSync(effect)          // Synchronous (throws on async or failure)
Effect.runSyncExit(effect)      // Returns Exit (no throw)
await Effect.runPromise(effect) // Promise-based
await Effect.runPromiseExit(effect)
Effect.runFork(effect)          // Fire and forget (returns Fiber)
```

## Generators (async/await style)

```typescript
const program = Effect.gen(function* () {
  const user = yield* getUser(id)
  const posts = yield* getPosts(user.id)
  return { user, posts }
})
```

- `yield*` unwraps an Effect (like `await` for promises)
- Errors short-circuit automatically
- The compiler tracks all error and requirement types through the generator

## Error management

```typescript
// Tagged errors
class NotFound extends Data.TaggedError("NotFound")<{ readonly id: string }> {}
class Unauthorized extends Data.TaggedError("Unauthorized")<{ readonly userId: string }> {}

// Catch by tag
program.pipe(Effect.catchTag("NotFound", (e) => Effect.succeed(`Not found: ${e.id}`)))

// Catch all expected errors
program.pipe(Effect.catchAll((e) => Effect.succeed("fallback")))

// Map error type
Effect.mapError(effect, (e) => new OtherError(e.message))

// Provide a fallback effect
Effect.orElse(effect, () => fallbackEffect)

// Retry on failure
Effect.retry(effect, Schedule.recurs(3))

// Handle both success and failure
Effect.match(effect, {
  onSuccess: (a) => `ok: ${a}`,
  onFailure: (e) => `err: ${e}`
})
```

## Services & dependency injection

```typescript
// Define
class Database extends Context.Tag("Database")<
  Database,
  { readonly query: (sql: string) => Effect.Effect<unknown[]> }
>() {}

// Use
const program = Effect.gen(function* () {
  const db = yield* Database
  return yield* db.query("SELECT * FROM users")
})
// Type: Effect<unknown[], never, Database>

// Provide
program.pipe(Effect.provideService(Database, { query: (sql) => Effect.sync(() => []) }))
```

## Layers

```typescript
// Simple layer
const DatabaseLive = Layer.succeed(Database, { query: (sql) => Effect.sync(() => []) })

// Layer that needs an effect
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config
    return { query: (sql) => Effect.promise(() => pgQuery(config.url, sql)) }
  })
)

// Layer with resource management
const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(
      Effect.sync(() => createPool()),
      (pool) => Effect.sync(() => pool.close())
    )
    return { query: (sql) => Effect.promise(() => pool.query(sql)) }
  })
)

// Compose layers
const AppLive = Layer.mergeAll(DatabaseLive, LoggerLive)
const ServiceLive = Layer.provide(ServiceLayer, DependencyLayer)

// Run with layers
Effect.runPromise(program.pipe(Effect.provide(AppLive)))
```

## Concurrency

```typescript
// Run effects concurrently
const results = yield* Effect.all([effectA, effectB, effectC], { concurrency: "unbounded" })
const results = yield* Effect.all(effects, { concurrency: 5 })
const results = yield* Effect.forEach(items, (item) => processItem(item), { concurrency: 10 })
const fastest = yield* Effect.race(effectA, effectB)

// Fibers
const fiber = yield* Effect.fork(longRunningTask)
const result = yield* Fiber.join(fiber)
yield* Fiber.interrupt(fiber)
```

## Resource management

```typescript
const managed = Effect.acquireRelease(
  Effect.sync(() => openConnection()),
  (conn) => Effect.sync(() => conn.close())
)

const program = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* managed
    return yield* conn.query("SELECT 1")
  })
)
```

## Ref, streams, scheduling

```typescript
// Ref (mutable state)
const counter = yield* Ref.make(0)
yield* Ref.update(counter, (n) => n + 1)
const value = yield* Ref.get(counter)

// Streams
Stream.make(1, 2, 3).pipe(
  Stream.map((n) => n * 2),
  Stream.filter((n) => n > 2),
  Stream.take(10)
)
Stream.runCollect(stream) // Effect<Chunk<A>>

// Scheduling
Effect.retry(effect, Schedule.recurs(3))
Effect.retry(effect, Schedule.exponential("100 millis"))
Effect.repeat(effect, Schedule.spaced("1 second"))
```

## Key principles

- Effects are values: describe computations but don't execute until run
- Errors are typed: the `E` parameter makes all failure modes explicit
- Dependencies are tracked: the `R` parameter ensures all requirements are provided
- Composition over inheritance: use pipes, generators, and layers
