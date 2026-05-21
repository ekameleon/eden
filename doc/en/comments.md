# Comments

eden accepts both line and block comments anywhere whitespace is
allowed. They are stripped by the parser and have no effect on the
parsed value.

## Line comments

```eden
{
    // unquoted keys make config files readable
    name: "Marc",
    // line comments run to the end of the line
}
```

A line comment starts at `//` and ends at the next line terminator
(`\n`, `\r`, ` `, ` `) or at end of input.

## Block comments

```eden
{
    name: "Marc",
    /*
     * Multi-line comments are also fine.
     * No nesting — see below.
     */
    active: true,
}
```

A block comment starts at `/*` and ends at the next `*/`. Block
comments **do not nest**: the first `*/` inside the body closes the
comment, regardless of what came before.

```eden
/* outer /* inner */ tail   // syntax error: `tail */` is no longer a comment
```

An unterminated block comment (reaches end of input without a
closing `*/`) raises `EdenSyntaxError`.

## Inside strings

A `//` or `/*` inside a string literal is just text — the lexer
recognizes comments only between tokens.

```eden
{
    sql: "SELECT // from users",        // the // is part of the string
    note: "block start /* keeps going", // same
}
```

## Disabling comments

Comments can be turned off entirely with `allowComments: false`. Any
`//` or `/*` then raises `EdenSyntaxError`. Useful when you want to
ensure pure JSON-style input:

```js
parse(source, { allowComments: false });
```

## Comments in the token stream

`tokenize` preserves comments as their own token types:

```
TokenType.LINE_COMMENT
TokenType.BLOCK_COMMENT
```

The parser skips them but they remain available for tools that care —
documentation generators, formatters that want to keep comments in
place, IDE highlight engines. See [tokenize](./tokenize.md).

## What about JSON?

JSON does not allow comments. If you feed an eden source with
comments to `JSON.parse`, it fails. `eden.parse` accepts them.

If you need a JSON-clean version of a commented eden source:

```js
import { parse, toJSON } from "@ekameleon/eden";

const value    = parse(commentedSource);
const jsonSafe = toJSON(value);   // comments dropped, strict JSON output
```

## Related

- [Data mode — `parse` / `parseToAST`](./data-mode.md)
- [Tokenize](./tokenize.md)
- Grammar reference: [`SPEC.md §2.4`](../../SPEC.md) (comments)
