# Errors — typed hierarchy

Every failure raised by eden extends `EdenError`, which itself
extends the native `Error`. You can catch the base class for a
blanket handler, or pin a specific subclass to react on a precise
failure mode.

## Hierarchy

```
Error
└── EdenError                ← base for every eden failure
    ├── EdenSyntaxError      ← lexer + parser failures (malformed source)
    ├── EdenReferenceError   ← evaluator: unresolved identifier or path
    ├── EdenSecurityError    ← reserved for future strict-policy denials
    └── EdenTypeError        ← serializer non-serializable values,
                               evaluator type mismatches, API misuse
```

All five classes are exported from the public façade:

```js
import {
    EdenError,
    EdenSyntaxError,
    EdenReferenceError,
    EdenSecurityError,
    EdenTypeError,
} from "@ekameleon/eden";
```

## Common shape

Every eden error carries:

| Field     | Type            | Meaning                                                 |
|-----------|-----------------|---------------------------------------------------------|
| `message` | `string`        | Human-readable description (English).                   |
| `source`  | `string \| null` | The source text the error refers to, when known.       |
| `offset`  | `number \| null` | Zero-based offset of the first faulty character.       |
| `line`    | `number \| null` | One-based line number.                                 |
| `column`  | `number \| null` | One-based column number.                               |
| `cause`   | `Error \| null` | Underlying error that triggered this one (when wrapping). |
| `name`    | `string`        | The error subclass name (`"EdenSyntaxError"`, …).       |

Location fields are `null` when the failure cannot be tied to a
specific position (typically API-level misuse).

## When each class is raised

### `EdenSyntaxError`

Bad source text. Raised by the lexer (illegal character, unterminated
string, illegal escape) and by the parser (unexpected token, wrong
shape, duplicate key in strict mode). `fromJSON` also wraps the
native `SyntaxError` from `JSON.parse` into this class.

```js
parse("{ unterminated"); // EdenSyntaxError at line 1, column 15
```

### `EdenReferenceError`

Raised by the evaluator when an identifier or member path does not
exist on the scope, or when the descent crosses a `null` or
`undefined` intermediate.

```js
evaluate("a.b.c", { scope: { a: {} } });
// EdenReferenceError: Path "a.b" is not defined in scope.
```

### `EdenSecurityError`

Reserved for a future strict policy mode. The default policy returns
`undefineable` silently and fires `onDenied` instead of throwing — see
[security policy](./security-policy.md). Throwing this class from the
`onDenied` hook is the recommended way to enforce a hard fail today.

### `EdenTypeError`

Two kinds of cases:

- **Serializer non-serializable values.** `BigInt` under
  `jsonCompatible`, circular structures, depth overflow, unknown AST
  node types.
- **Evaluator type mismatches.** Currently raised on a forged unknown
  AST node type.

```js
stringify(1n, { jsonCompatible: true });
// EdenTypeError: Cannot serialize BigInt in jsonCompatible mode.
```

## Catching errors

### Blanket handler

```js
import { evaluate, EdenError } from "@ekameleon/eden";

try {
    evaluate(source, options);
} catch (error) {
    if (error instanceof EdenError) {
        log.warn("eden failure", {
            name:    error.name,
            line:    error.line,
            column:  error.column,
            message: error.message,
        });
    } else {
        throw error;     // bubble unrelated errors
    }
}
```

### Class-specific reactions

```js
import {
    parse,
    EdenSyntaxError,
} from "@ekameleon/eden";

try {
    parse(input);
} catch (error) {
    if (error instanceof EdenSyntaxError) {
        editor.markError(error.line, error.column, error.message);
    }
}
```

### Following the `cause` chain

```js
import { fromJSON } from "@ekameleon/eden";

try {
    fromJSON("{ not json }");
} catch (error) {
    // error instanceof EdenSyntaxError
    // error.cause instanceof SyntaxError
    console.log(error.cause.message); // native JSON.parse message
}
```

## Best practices

- **Catch `EdenError`** when you do not care which step failed (for
  logging, telemetry, blanket fallback).
- **Catch the subclass** when you want to react on a precise mode —
  e.g. show a syntax marker in an editor only on `EdenSyntaxError`.
- **Never swallow `EdenReferenceError` silently** in production unless
  you intend the missing-identifier case. It typically signals a
  config mismatch between the eden source and the runtime scope.

## Related

- [Evaluation mode — `evaluate`](./evaluation-mode.md)
- [Security policy](./security-policy.md)
- Architecture reference: [`ARCHITECTURE.md §7`](../../ARCHITECTURE.md)
