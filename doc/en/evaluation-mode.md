# Evaluation mode — `evaluate`

Evaluation mode is the **opt-in** runtime side of eden. It runs an
eden program against an explicit `scope` and a `policy`, with full
support for identifier resolution, member access, function calls,
`new` expressions and assignments.

Use this when your configuration legitimately needs things you
cannot express as pure data — typically `new Date(...)` or
`Array.from(...)`.

Use [data mode](./data-mode.md) for everything else. Data mode is
strictly safer: no scope, no calls, no `new`.

## `evaluate(source, options?)`

```js
import { evaluate } from "@ekameleon/eden";

const result = evaluate(
    `user = { name: "Marc", joined: new Date("2024-01-15") }
     user.active = true
     user`,
    {
        scope:  {},
        policy: {
            allowConstructor: true,
            authorized:       ["Date"],
        },
    },
);
// result === scope.user === { name, joined: Date, active: true }
```

### The result of an eval program

Per `SPEC.md §3.2`, the program returns the value of the **last
non-assignment expression**. If the program consists only of
assignments, the result is `undefined`. The assignments themselves
still take effect on the scope — only the return value is suppressed.

```js
evaluate("a = 1; b = 2", { scope: {} });        // undefined
evaluate("a = 1; b = 2; b", { scope: {} });     // 2
```

## What goes into `options`

`evaluate` accepts both **parser** and **evaluator** options in the
same bag:

- `ParseOptions` — `allowComments`, `allowTrailingCommas`,
  `allowSingleQuotes`, `allowUnquotedKeys`, `allowTemplates`,
  `allowBigInt`, `allowEmptySource`, `strictMode`, `maxDepth`,
  `maxStringLength`. See [data mode](./data-mode.md) for details.
- `EvaluateOptions`:
  - `scope` — the root object used for identifier resolution. Defaults
    to `{}`.
  - `policy` — the security policy. See [security
    policy](./security-policy.md) for the full surface.

`options.mode` is always overridden to `"eval"`. Passing `"data"` is
silently ignored — callers wanting data-mode parsing should use
[`parse`](./data-mode.md).

## Scope

The scope is the **root** for every identifier eden resolves. There
is no notion of ambient globals in eden — if `Math` is not on the
scope, the source cannot see it. This is deliberate: it makes the
sandboxing trivial to reason about.

```js
evaluate("Math.sqrt(4)", {
    scope:  { Math },
    policy: { allowFunctionCall: true, authorized: ["Math.*"] },
});
// 2
```

### Identifier and member resolution

- An `Identifier` (`foo`) resolves to `scope.foo`.
- A `MemberExpression` (`obj.x`, `arr[0]`) walks the scope path.
- Missing identifiers or missing paths raise `EdenReferenceError`.
- Descending through `null` or `undefined` raises `EdenReferenceError`.
- Primitives auto-box, so `"hello".length` resolves to `5` even though
  the intermediate is a string.

### Assignment

```js
const scope = {};
evaluate("user.profile.name = \"Marc\"", { scope });
// scope === { user: { profile: { name: "Marc" } } }
```

Assignment creates missing intermediate objects on the fly, per
SPEC §5.2. Numeric computed keys (`arr[0]`) target plain-object
properties named `"0"`, **not** array elements — eden never
fabricates a JavaScript `Array` instance behind your back.

Writing through a primitive intermediate (`s.x = 1` when
`s = "hello"`) surfaces the native `TypeError`.

## Function calls and constructors

Both go through the [security policy](./security-policy.md):

```js
evaluate("new Date(\"2024-01-15\")", {
    scope: { Date },
});
// Date instance — `allowConstructor: true` + `"Date"` authorized by default
```

Member-style calls (`obj.method(args)`) bind `this` to the parent
object, so `obj.getX()` sees `this === obj`. Plain identifier calls
have `this === undefined` (strict mode).

A denied call returns the policy's `undefineable` value (default
`undefined`) and triggers the `onDenied` hook if any.

## Error handling

```js
import {
    evaluate,
    EdenSyntaxError,
    EdenReferenceError,
} from "@ekameleon/eden";

try {
    evaluate("a.b.c", { scope: { a: {} } });
} catch (error) {
    if (error instanceof EdenReferenceError) {
        // "Path \"a.b\" is not defined in scope."
    }
}
```

See [errors](./errors.md) for the full hierarchy.

## Related

- [Security policy](./security-policy.md)
- [Data mode — `parse` / `parseToAST`](./data-mode.md)
- [Errors](./errors.md)
- Normative semantics: [`SPEC.md §5`](../../SPEC.md)
