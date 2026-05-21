# Objects and arrays

Composite literals are the bread and butter of eden documents. The
syntax is the modern JavaScript object/array literal, with a few
extra conveniences and a few documented restrictions.

## Arrays

```eden
[]
[1, 2, 3]
[1, 2, 3,]                  // trailing comma allowed
["mixed", true, null]
[[1, 2], [3]]               // nested
```

- Elisions are **not** supported. `[1, , 3]` raises `EdenSyntaxError`;
  use `undefined` or `null` explicitly.
- A trailing comma is accepted on the last element by default; set
  `allowTrailingCommas: false` to forbid it.

## Objects

```eden
{}
{ name: "Marc" }                            // unquoted identifier key
{ "key with space": 1 }                     // quoted key
{ 0: "first" , 1: "second" }                // numeric integer key
{ name: "Marc", active: true , }            // trailing comma allowed
```

### Property keys

Three key shapes are accepted:

- `Identifier` — unquoted, must match the identifier grammar
  (letters, digits, `_`, `$`) and must not be a reserved word.
- `StringLiteral` — quoted (`"..."`, `'...'` or `` `...` ``).
- `NumericLiteral` — any number literal eden recognizes.

| Source key   | Runtime key (string) | Stringify output (defaults) |
|--------------|---------------------|------------------------------|
| `name`       | `"name"`            | `name`                       |
| `"name"`     | `"name"`            | `name` (unquotedKeys=true)   |
| `"name"`     | `"name"`            | `"name"` (unquotedKeys=false)|
| `0`          | `"0"`               | `0`                          |
| `0xFF`       | `"255"`             | `0xFF` (AST path) / `255` (value path) |
| `"01"`       | `"01"`              | `"01"` (quoted — leading zero) |
| `"1.5"`      | `"1.5"`             | `"1.5"` (quoted — non-integer) |
| `"with space"` | `"with space"`    | `"with space"` (quoted)      |

Identifiers that **look** like reserved words are always quoted in
the output: `{ null: 1 }` is rejected by the parser (data mode); a
runtime value with the key `"null"` stringifies as `{"null": 1}` even
under `unquotedKeys: true`.

### Duplicate keys

Per `SPEC.md §3.5`, the last definition wins, matching JavaScript
object literal semantics. The eden parser raises `EdenSyntaxError`
on duplicate keys when `strictMode: true` (the default); set
`strictMode: false` to let the duplicate through with a runtime
last-wins resolution.

## Shorthand and computed properties (eval mode only)

These two property shapes are accepted in **eval mode only**, since
they need a runtime scope to make sense:

```eden
// Shorthand: { name } reads `name` from the scope and stores it
// under the key "name".
{ name }

// Computed key: the bracketed expression is evaluated and coerced
// to a string at runtime.
{ [keyVar]: 1, [obj.k]: 2 }
```

Data-mode `parse` rejects both. Eval-mode `evaluate` accepts both.

## Trailing commas

Both arrays and objects accept a trailing comma:

```eden
[1, 2, 3,]
{ a: 1, b: 2, }
```

`stringify` does **not** emit trailing commas by default. Set
`trailingCommas: true` and use a non-zero `indent` to get them on the
output side:

```js
stringify({ a: 1, b: 2 }, { indent: 2, trailingCommas: true });
// "{
//   a: 1,
//   b: 2,
// }"
```

In compact (inline) form the option is ignored — a trailing comma on
a single line is visually noisy and brings no diff benefit.

`jsonCompatible: true` always suppresses trailing commas, since JSON
forbids them.

## Maximum depth

Both the parser and the serializer cap the composite nesting depth at
`1024` by default, to avoid stack overflows on adversarial input.
Raise `maxDepth` when you legitimately need deeper structures, or
drop it to `Infinity` to disable the guard.

```js
parse(source, { maxDepth: Infinity });
stringify(value, { maxDepth: 64 });
```

## Cycle detection (stringify)

`stringify` detects circular runtime structures and raises
`EdenTypeError("Converting circular structure to eden.")` instead of
overflowing the stack. Sibling-shared sub-objects are **not** cycles
and serialize fine:

```js
const shared = { x: 1 };
stringify({ a: shared, b: shared }); // OK — "{a:{x:1},b:{x:1}}"

const cycle = {};
cycle.self = cycle;
stringify(cycle); // EdenTypeError
```

## Related

- [Data mode — `parse` / `parseToAST`](./data-mode.md)
- [Stringify — `stringify` / `stringifyAST`](./stringify.md)
- [Evaluation mode — `evaluate`](./evaluation-mode.md)
- Grammar reference: [`SPEC.md §3.4`](../../SPEC.md) (arrays),
  [`SPEC.md §3.5`](../../SPEC.md) (objects)
