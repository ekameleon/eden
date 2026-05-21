# Stringify — `stringify` and `stringifyAST`

eden ships two complementary entry points for going **from a value to
a string**:

- `stringify(value, options?)` — takes a JavaScript value, returns
  an eden (or JSON) source string. The mirror of `parse`.
- `stringifyAST(ast, options?)` — takes an AST node (typically produced
  by `parseToAST`), returns a source string. Preserves the original
  `raw` lexemes when possible, so a parse / stringify round trip is
  lossless on numeric bases, separators, quote styles, etc.

## `stringify(value, options?)`

```js
import { stringify } from "@ekameleon/eden";

stringify({ name: "Marc", tags: ["dev", "maker"] });
// '{name:"Marc",tags:["dev","maker"]}'

stringify({ name: "Marc" }, { indent: 2 });
// '{\n  name: "Marc"\n}'
```

## `stringifyAST(ast, options?)`

`stringifyAST` walks an AST instead of a value. It is the right entry
point for formatters, code transformations, and any tool that produced
or modified an AST and wants a faithful source back.

```js
import { parseToAST, stringifyAST } from "@ekameleon/eden";

const ast  = parseToAST("{ count: 0xFF, big: 1_000n }");
const back = stringifyAST(ast);
// "{ count: 0xFF, big: 1_000n }"  — original lexemes preserved
```

The same AST through `stringify(parse(...))` would round-trip the
values, but normalize `0xFF` to `255` and `1_000n` to `1000n`. Use
`stringifyAST` whenever the source text fidelity matters.

## StringifyOptions

| Option            | Default    | Effect                                                       |
|-------------------|------------|--------------------------------------------------------------|
| `indent`          | `0`        | Number of spaces, or an explicit indent string. `0` / `""` → inline compact form. Clamped to 10 spaces / 10 characters. |
| `quotes`          | `"double"` | Preferred string quote style. `"double"` or `"single"`.       |
| `trailingCommas`  | `false`    | Add a trailing comma on the last entry of indented arrays and objects. |
| `unquotedKeys`    | `true`     | Emit identifier-shape keys without quotes. Numeric integer keys (no leading zero) are also unquoted. |
| `sortKeys`        | `false`    | Emit object keys in lexicographic order.                     |
| `jsonCompatible`  | `false`    | Force strict JSON output: quoted keys, no templates, no BigInt, no `undefined`, `NaN`/`±Infinity` collapse to `null`, no trailing commas. |
| `replacer`        | `null`     | `(key, value) => replacement` function applied per entry. Same semantics as `JSON.stringify`. |
| `maxDepth`        | `1024`     | Maximum composite nesting depth before raising `EdenTypeError`. Symmetric with `ParseOptions.maxDepth`. |

### Indentation

```js
stringify([1, 2, 3]);                    // "[1,2,3]"
stringify([1, 2, 3], { indent: 2 });
// "[
//    1,
//    2,
//    3
//  ]"
stringify([1, 2, 3], { indent: "\t" });  // tab-indented form
```

`indent` accepts a number (spaces) or a string (used as the indent
unit). Numbers above 10 are clamped to 10 spaces; strings longer than
10 characters are truncated to 10. The behavior mirrors
`JSON.stringify`.

### Quote style

```js
stringify("Hello", { quotes: "single" }); // "'Hello'"
stringify("It's me");                     // '"It\'s me"' ... no, no escape needed:
                                          // '"It\'s me"' would be wrong — actual: '"It\'s me"'
                                          // The output is "It's me" — single quote is safe inside double.
```

`quotes` controls whether `stringify` emits `"..."` or `'...'`. Either
quote is escaped only when it conflicts with the active style.

### Sorting keys

```js
stringify({ b: 1, a: 2 }, { sortKeys: true });
// "{a:2,b:1}"
```

Useful for canonical output: cache keys, hashing, deterministic diffs.

### JSON-compatible mode

```js
stringify({ a: 1, b: undefined, c: NaN }, { jsonCompatible: true });
// '{"a":1,"c":null}'
```

`jsonCompatible: true` produces strict JSON. `BigInt` values raise
`EdenTypeError` (matching `JSON.stringify`). `undefined` in arrays
becomes `null`; `undefined` in objects is dropped.

For a discoverable wrapper around this option, see
[`fromJSON` / `toJSON`](./json-interop.md).

### Replacer

```js
const result = stringify(
    { keep: 1, drop: 2, age: 30 },
    { replacer: (key, value) => key === "drop" ? undefined : value }
);
// '{keep:1,age:30}'
```

Same semantics as `JSON.stringify`:

- Invoked first with `key === ""` against a synthetic wrapper, allowing
  the root value itself to be replaced or dropped.
- In objects: returning `undefined` drops the entry.
- In arrays: returning `undefined` becomes `null`.

The replacer is only consulted on the **value** path. `stringifyAST`
ignores it — that path is structural by design.

### Cycle detection

```js
const obj = {};
obj.self = obj;
stringify(obj); // EdenTypeError: "Converting circular structure to eden."
```

Self-references and mutual cycles raise `EdenTypeError` rather than
overflowing the stack. Sharing a sub-object across siblings (used twice
but not in an ancestor) is **not** a cycle and works as expected.

## Round trip

```js
import { parse, stringify } from "@ekameleon/eden";

const original = '{ name: "Marc", tags: ["dev"] }';
const value    = parse(original);
const back     = stringify(value, { indent: 4 });
const reparsed = parse(back);
// value and reparsed are deeply equal
```

The value-level round trip is always lossless (modulo documented
substitutions in `jsonCompatible` mode). For lexeme-level fidelity
(numeric bases, separators, exact quote styles), use the AST round
trip — `parseToAST` then `stringifyAST`.

## Related

- [Data mode — `parse` / `parseToAST`](./data-mode.md)
- [JSON interop — `fromJSON` / `toJSON`](./json-interop.md)
- [Numbers and BigInt](./numbers.md)
- [Errors](./errors.md)
- Architecture reference: [`ARCHITECTURE.md §6.2`](../../ARCHITECTURE.md) (StringifyOptions)
