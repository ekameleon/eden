# Security policy

The security policy is the **gate** between an eden eval-mode program
and the host environment. It controls what can be called and what
can be constructed. Plain reads (identifiers and member access) are
**not** gated by the policy — the user has already chosen what to
expose by putting it on the scope.

The policy is **fail-closed**: every option defaults to "deny", and
the user opts in to specific paths.

## Shape

```js
{
    allowFunctionCall: false,
    allowConstructor:  true,
    authorized:        [
        "Array", "Boolean", "Date", "Error",
        "Math.*", "Number.*", "Object", "String.*",
        "Infinity",
    ],
    undefineable: undefined,
    onDenied:     null,
}
```

| Field               | Default     | Meaning                                                                   |
|---------------------|-------------|---------------------------------------------------------------------------|
| `allowFunctionCall` | `false`     | Function calls are denied unless this is `true` and the path is authorized. |
| `allowConstructor`  | `true`      | `new` expressions are denied unless this is `true` and the path is authorized. |
| `authorized`        | (see above) | Glob patterns of invocable paths.                                         |
| `undefineable`      | `undefined` | Value returned in place of a denied invocation. Default: silently `undefined`. |
| `onDenied`          | `null`      | Optional `(path) => void` hook fired before returning `undefineable`.     |

## Glob matching

Two forms are recognized:

- **Exact path** — `"Date"` matches the path `"Date"` only.
- **Suffix wildcard** — `"Math.*"` matches every path starting with
  `"Math."` (one **or more** segments). `"Math.PI"`, `"Math.sqrt"`,
  `"Math.SubModule.fn"` all match; the bare `"Math"` does **not**.

Middle-position wildcards (`"a.*.c"`) are not supported in v0.1.0.

The match is **case-sensitive**: `"math"` does not match `"Math"`.

## What "path" means

The path is **static** — it comes from the source as written, not
from the runtime value. For:

```eden
d = new Date("2024-01-15")
d.getFullYear()
```

the second statement invokes the path `"d.getFullYear"`. The user must
authorize `"d.*"` (or the exact path) to allow it, even though `d`
holds a `Date` instance. This is the documented tradeoff of a
static-path policy: predictable, but it asks the user to whitelist
variable names too.

## Denial behavior

When an invocation is denied:

1. `onDenied(path)` fires, if set.
2. The configured `undefineable` value is returned (default
   `undefined`).

No exception is thrown by default. This makes denial easy to wrap
in defensive code:

```js
evaluate("forbidden()", {
    scope: { forbidden: () => "secret" },
    // default policy: allowFunctionCall is false → denied
});
// returns undefined; nothing leaks.
```

If you prefer a hard failure, throw from the hook:

```js
policy: {
    onDenied(path) {
        throw new Error(`eden denied: ${path}`);
    },
}
```

## Custom `undefineable`

`undefineable` lets you spot denials at the call site:

```js
const DENIED = Symbol("denied");

const policy = {
    allowFunctionCall: false,
    authorized:        [],
    undefineable:      DENIED,
};

const result = evaluate("forbidden()", { scope: { forbidden: () => 1 }, policy });
if (result === DENIED) {
    // ... explicit fallback
}
```

## Recipes

### Strict read-only

```js
{
    allowFunctionCall: false,
    allowConstructor:  false,
    authorized:        [],
}
```

The scope can still be read; nothing can be invoked or constructed.
Good for evaluating typed configs that may reference identifiers but
must never run code.

### Math + Date utilities

```js
{
    allowFunctionCall: true,
    allowConstructor:  true,
    authorized:        ["Math.*", "Number.*", "Date", "Date.*"],
}
```

Lets the source use `Math.sqrt(...)`, `Number.parseInt(...)`,
`new Date(...)`, and call methods on `Date` instances if their
variable name is also whitelisted.

### Observability

```js
{
    onDenied(path) {
        telemetry.warn("eden.denied", { path });
    },
}
```

Pair with the silent-return default to **monitor** without breaking.

## Related

- [Evaluation mode — `evaluate`](./evaluation-mode.md)
- [Errors](./errors.md)
- Normative semantics: [`SPEC.md §5.5`](../../SPEC.md)
- Architecture reference: [`ARCHITECTURE.md §6.3`](../../ARCHITECTURE.md)
