# JSON interop — `fromJSON` and `toJSON`

eden ships two thin convenience wrappers for moving back and forth
between JSON and eden source strings without dropping into the
lower-level entry points.

## `toJSON(value, options?)`

```js
import { toJSON } from "@ekameleon/eden";

toJSON({ name: "Marc", tags: ["dev"] });
// '{"name":"Marc","tags":["dev"]}'

toJSON({ name: "Marc" }, { indent: 2 });
// '{\n  "name": "Marc"\n}'
```

Functionally equivalent to:

```js
stringify(value, { ...options, jsonCompatible: true });
```

`jsonCompatible: true` is forced on; any other `StringifyOptions`
(`indent`, `sortKeys`, `replacer`, `maxDepth`, …) is forwarded as-is.
Options that have no effect in JSON-compat mode (`unquotedKeys`,
`quotes`, `trailingCommas`) are silently neutralized.

`BigInt` values raise `EdenTypeError`, matching the behavior of
`JSON.stringify`.

## `fromJSON(jsonSource, options?)`

```js
import { fromJSON } from "@ekameleon/eden";

fromJSON('{"name":"Marc","tags":["dev"]}');
// '{name:"Marc",tags:["dev"]}'

fromJSON('{"a":1}', { indent: 2, quotes: "single" });
// "{\n  a: 1\n}"
```

The input is parsed with the native `JSON.parse` (strict, fast,
well-tested) and re-emitted through the eden serializer using the
supplied options. By default the output uses eden idioms:
unquoted identifier keys, double-quoted strings, no trailing commas.

A malformed JSON input raises `EdenSyntaxError`, with the original
native `SyntaxError` preserved on the `cause` chain so callers can
catch a single error type:

```js
try {
    fromJSON("{ this is not json }");
} catch (error) {
    error instanceof EdenSyntaxError; // true
    error.cause instanceof SyntaxError; // true (native)
}
```

## Substitutions

Both functions honor the SPEC §6.1 rules for the JSON output side:

| Input                  | Output (`toJSON`, JSON side) |
|------------------------|------------------------------|
| `undefined` in object  | dropped                      |
| `undefined` in array   | `null`                       |
| `undefined` top-level  | `"null"`                     |
| `NaN`, `±Infinity`     | `null`                       |
| `BigInt`               | raises `EdenTypeError`       |
| Object keys            | always double-quoted         |
| Template literals      | downgraded to JSON strings   |
| Trailing commas        | suppressed                   |

## Round trip

```js
import { parse, fromJSON, toJSON } from "@ekameleon/eden";

const jsonSrc = '{"name":"Marc","tags":["dev"]}';
const value   = parse(fromJSON(jsonSrc));
JSON.parse(toJSON(value)).deepEqual(value); // true
```

`JSON.parse(toJSON(value))` always succeeds and returns a value
deep-equal to the original (modulo the documented substitutions).
`parse(fromJSON(jsonSrc))` is structurally equivalent to
`JSON.parse(jsonSrc)`.

## When to use what

| Need | Use |
|---|---|
| Take a JS value, emit eden | `stringify` |
| Take a JS value, emit strict JSON | `toJSON` (or `stringify(..., { jsonCompatible: true })`) |
| Reformat a JSON file into eden idioms | `fromJSON` |
| Parse JSON | `JSON.parse` (eden's `parse` accepts JSON too, but `JSON.parse` is faster for pure JSON) |

## Related

- [Stringify — `stringify` / `stringifyAST`](./stringify.md)
- [Data mode — `parse` / `parseToAST`](./data-mode.md)
- Spec rules: [`SPEC.md §6`](../../SPEC.md)
