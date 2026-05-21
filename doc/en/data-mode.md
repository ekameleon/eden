# Data mode — `parse` and `parseToAST`

Data mode is the safe, JSON-compatible surface of eden. It accepts
literals, arrays, objects, and unary `+/-` on numeric values; it
rejects identifier references, member access, function calls and
constructors. Whatever runs in data mode runs without touching any
runtime scope.

This is the right entry point for:

- configuration files,
- API payloads,
- anything you would have used `JSON.parse` for.

## `parse(source, options?)`

```js
import { parse } from "@ekameleon/eden";

const value = parse(`{
    name: "Marc",
    active: true,
    tags: ["dev", "maker",],
}`);
// {
//     name: "Marc",
//     active: true,
//     tags: ["dev", "maker"],
// }
```

`parse` returns the JavaScript value the source describes. It throws
[`EdenSyntaxError`](./errors.md) on malformed input.

Every valid JSON document is a valid eden document. Pointing `parse`
at a JSON file is always safe.

## `parseToAST(source, options?)`

`parseToAST` returns the **AST** for the same source instead of a
runtime value. The AST preserves the original syntactic shape (numeric
base, separator, quote style, …) and is the right entry point for
tools that need to walk or transform the source — formatters, language
servers, linters.

```js
import { parseToAST } from "@ekameleon/eden";

const ast = parseToAST(`{ name: "Marc", tags: ["dev"] }`);
// Program { mode: "data", body: [ ObjectExpression { ... } ] }
```

See [AST reference](./ast-reference.md) for the per-node shape.

## ParseOptions

Every option below is optional. The defaults are listed first.

| Option              | Default     | Effect                                                       |
|---------------------|-------------|--------------------------------------------------------------|
| `allowComments`     | `true`      | Accept `//` and `/* */` comments.                            |
| `allowTrailingCommas` | `true`    | Accept a trailing comma in arrays and objects.               |
| `allowSingleQuotes` | `true`      | Accept `'...'` string literals.                              |
| `allowUnquotedKeys` | `true`      | Accept identifier-shape keys without quotes.                 |
| `allowTemplates`    | `true`      | Accept `` `...` `` template literals.                        |
| `allowBigInt`       | `true`      | Accept `…n` BigInt literals.                                 |
| `allowEmptySource`  | `true`      | `parse("")` yields `undefined` instead of throwing.          |
| `strictMode`        | `true`      | Reject duplicate object keys at parse time.                  |
| `maxDepth`          | `1024`      | Maximum nesting depth before raising `EdenSyntaxError`.      |
| `maxStringLength`   | `Infinity`  | Hard cap on the length of any single string literal.         |

### Tightening the dialect

To restrict the input to strict JSON:

```js
parse(source, {
    allowComments:       false,
    allowTrailingCommas: false,
    allowSingleQuotes:   false,
    allowUnquotedKeys:   false,
    allowTemplates:      false,
    allowBigInt:         false,
});
```

This is occasionally useful when you want the eden library on the
producer side and strict JSON on the consumer side, or for defensive
input validation.

### Empty source

By default `parse("")` returns `undefined`. To turn an empty input
into a syntax error, set `allowEmptySource: false`.

```js
parse("", { allowEmptySource: false }); // throws EdenSyntaxError
```

## Related

- [Stringify — `stringify` / `stringifyAST`](./stringify.md)
- [JSON interop — `fromJSON` / `toJSON`](./json-interop.md)
- [Numbers and BigInt](./numbers.md)
- [Comments](./comments.md)
- Grammar reference: [`SPEC.md §3.1`](../../SPEC.md) (data mode program)
