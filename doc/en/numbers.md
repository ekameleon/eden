# Numbers and BigInt

eden inherits the number model of ECMAScript: every numeric literal
without the `n` suffix parses to an IEEE-754 double-precision Number;
literals with the `n` suffix parse to a `BigInt`. Three numeric bases
and digit separators are accepted, matching the modern JavaScript
syntax.

## Decimal

```eden
0
42
1.5
-1.5
1e10
1.5e-3
1_000_000          // underscore separators between digits
```

Numeric separators are purely cosmetic — they have no effect on the
parsed value (`1_000_000 === 1000000`). They are allowed between
digits only; leading, trailing or consecutive separators raise
`EdenSyntaxError`.

A literal can carry a fractional part **or** an exponent, in any
combination.

## Hexadecimal, octal, binary

```eden
0xFF              // hex   → 255
0o17              // octal → 15  (modern prefix only; 017 is rejected)
0b1010            // binary→ 10
```

Legacy ECMAScript-style octals (`0777` without the explicit `0o`
prefix) are **not** supported — use the modern form.

The `0x`, `0o`, `0b` prefixes accept the same digit-separator rule as
decimals: `0xFF_FF`, `0b1010_0101`.

## BigInt

```eden
0n
1n
9007199254740993n          // exceeds Number.MAX_SAFE_INTEGER
1_000n                     // separators allowed
0xFFn                      // bases allowed
```

BigInts cannot have a fractional part or an exponent — same rule as
ECMAScript. Both the decimal/exponent rule and the `n` suffix are
checked by the lexer.

### BigInt in JSON-compat mode

`JSON.parse` cannot read BigInt literals and `JSON.stringify` refuses
to serialize them. eden mirrors this:

- `stringify(1n, { jsonCompatible: true })` → throws `EdenTypeError`.
- `fromJSON("1n")` → throws `EdenSyntaxError` (the native `JSON.parse`
  rejects it).
- `toJSON({ big: 1n })` → throws `EdenTypeError`.

Use BigInts only in pure eden mode, not when interoperating with JSON.

## Special values

`NaN` and `Infinity` are keywords in eden. They evaluate to the
JavaScript constants `Number.NaN` and `Number.POSITIVE_INFINITY`
respectively.

```eden
NaN              // Number.NaN
Infinity         // Number.POSITIVE_INFINITY
-Infinity        // Number.NEGATIVE_INFINITY (unary minus)
-NaN             // Number.NaN (unary minus on NaN is still NaN)
```

### In `jsonCompatible` mode

JSON has no syntax for `NaN` or `±Infinity`. `stringify` substitutes
them with `null` when `jsonCompatible: true`:

```js
stringify({ x: NaN, y: Infinity }, { jsonCompatible: true });
// '{"x":null,"y":null}'
```

## Unary `+/-` on numeric literals

```eden
-1
+1
-1n              // negated BigInt
-Infinity
-NaN
```

In data mode the unary operator can only sit in front of a numeric
literal (Number, BigInt, `Infinity`, `NaN`) — that is the SPEC §3.1
`UnaryValue` rule.

In eval mode the unary operator accepts any expression that resolves
to a numeric value (`-foo` reads `foo` from the scope and negates it).

### `+` on a `BigInt` raises `TypeError`

```js
evaluate("+1n", {});
// TypeError (native): "Cannot convert a BigInt value to a number"
```

This is the host JavaScript behavior — `+1n` is illegal in JS too.
The negation `-1n` works fine.

## Round-trip fidelity through the AST

The AST preserves the **raw lexeme** of every numeric literal. A
parse / stringify round trip through `parseToAST` + `stringifyAST`
keeps `0xFF` as `0xFF`, `1_000n` as `1_000n`, `1.5e2` as `1.5e2`.

```js
import { parseToAST, stringifyAST } from "@ekameleon/eden";

stringifyAST(parseToAST("0xFF")); // "0xFF" — preserved
stringify(255);                   // "255"   — recomputed from value
```

`jsonCompatible: true` always recomputes from the value, since the
target dialect (JSON) does not accept hex / binary / octal numeric
literals or separators.

## Related

- [Data mode — `parse` / `parseToAST`](./data-mode.md)
- [Stringify — `stringify` / `stringifyAST`](./stringify.md)
- [JSON interop — `fromJSON` / `toJSON`](./json-interop.md)
- Grammar reference: [`SPEC.md §2.8`](../../SPEC.md) (numeric literals)
