# Effect Schema quick reference

## The Schema type

```typescript
Schema<Type, Encoded, Requirements>
```

- **Type (A)**: The decoded output type
- **Encoded (I)**: The input/encoded type (defaults to Type)
- **Requirements (R)**: Contextual dependencies (defaults to `never`)

## Primitives

```typescript
import { Schema } from "effect"

Schema.String    Schema.Number    Schema.Boolean
Schema.BigIntFromSelf    Schema.Object    Schema.Undefined
Schema.Void    Schema.Any    Schema.Unknown    Schema.Never
```

## Structs, literals, unions

```typescript
const Person = Schema.Struct({ name: Schema.String, age: Schema.Number })

// Type extraction
type PersonType = Schema.Type<typeof Person>
interface Person extends Schema.Type<typeof Person> {}

const Status = Schema.Literal("active", "inactive", "pending")
const Flexible = Schema.Union(Schema.String, Schema.Number)
```

## Optional fields

```typescript
const Product = Schema.Struct({
  name: Schema.String,
  quantity: Schema.optional(Schema.Number)
})

// Optional with a default
const WithDefault = Schema.Struct({
  role: Schema.optional(Schema.String).pipe(Schema.withDefault(() => "user"))
})
```

## Arrays, tuples, records

```typescript
Schema.Array(Schema.String)
Schema.NonEmptyArray(Schema.Number)
Schema.Tuple(Schema.String, Schema.Number)
Schema.Record({ key: Schema.String, value: Schema.Number })
```

## Decoding and encoding

```typescript
// Decode (parse external data)
Schema.decodeUnknownSync(schema)(input)        // throws on error
Schema.decodeUnknownEither(schema)(input)      // Returns Either
await Schema.decodeUnknown(schema)(input)      // Returns Effect

// Encode (serialize)
Schema.encodeSync(schema)(value)
Schema.encodeEither(schema)(value)

// Options
Schema.decodeUnknownEither(schema, {
  errors: "all",
  onExcessProperty: "error"
})(input)
```

## Transformations

```typescript
// Guaranteed-success
const StringToNumber = Schema.transform(Schema.String, Schema.Number, {
  decode: (s) => parseFloat(s),
  encode: (n) => String(n)
})

// Fallible
const SafeStringToNumber = Schema.transformOrFail(Schema.String, Schema.Number, {
  decode: (s) => {
    const n = parseFloat(s)
    return isNaN(n)
      ? ParseResult.fail(new ParseResult.Type(Schema.Number.ast, s))
      : ParseResult.succeed(n)
  },
  encode: (n) => ParseResult.succeed(String(n))
})
```

Built-in transforms: `trim`, `lowercase`, `uppercase`, `split`, `parseJson`, `NumberFromString`, `Date`, `Base64`, `Hex`

## Filters and refinements

```typescript
const LongString = Schema.String.pipe(
  Schema.filter((s) => s.length >= 10 || "must be at least 10 characters")
)
```

Built-in filters:
- **String**: `maxLength(n)`, `minLength(n)`, `nonEmptyString()`, `length(n)`, `pattern(regex)`, `startsWith(s)`, `endsWith(s)`, `includes(s)`, `trimmed()`
- **Number**: `greaterThan(n)`, `lessThan(n)`, `between(min, max)`, `int()`, `positive()`, `nonNegative()`, `multipleOf(n)`
- **Number shorthands**: `Schema.Int`, `Schema.Positive`, `Schema.NonNegative`
- **Array**: `maxItems(n)`, `minItems(n)`, `itemsCount(n)`

## Classes

```typescript
class Person extends Schema.Class<Person>("Person")({
  id: Schema.Number,
  name: Schema.NonEmptyString
}) {
  get upperName() { return this.name.toUpperCase() }
}

// Extending
class Employee extends Schema.Class<Employee>("Employee")({
  ...Person.fields,
  department: Schema.String
}) {}
```

## Brands

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = Schema.Type<typeof UserId>
const id = UserId.make("abc123")
```

## Property signatures

```typescript
// Rename fields
const User = Schema.Struct({
  name: Schema.propertySignature(Schema.String).pipe(Schema.fromKey("user_name"))
})
// Decodes { user_name: "Alice" } → { name: "Alice" }
```

## Recursive schemas

```typescript
interface Category {
  readonly name: string
  readonly children: ReadonlyArray<Category>
}

const Category: Schema.Schema<Category> = Schema.suspend(() =>
  Schema.Struct({ name: Schema.String, children: Schema.Array(Category) })
)
```

## Effect data types

```typescript
Schema.Option(Schema.String)                              // { _tag, value }
Schema.OptionFromNullOr(Schema.String)                    // null → None
Schema.Either({ left: Schema.String, right: Schema.Number })
Schema.ReadonlySet(Schema.Number)                         // Array ↔ Set
Schema.ReadonlyMap({ key: Schema.String, value: Schema.Number })
Schema.Duration                                           // millis
```

## Key principles

- Schemas are immutable values: every operation returns a new schema
- Bidirectional: every schema supports both decoding and encoding
- Encoded ≠ Type: the wire format can differ from the in-memory type
- Validate at boundaries: decode external data at system edges
