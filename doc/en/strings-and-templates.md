# Strings and templates

eden supports three ways to write string-like values. They share the
same escape rules; the only real differences are the delimiter and
whether line terminators inside the body are allowed.

## Three delimiters

```eden
"double-quoted string"
'single-quoted string'
`template literal`
```

| Delimiter | Line terminators inside | Typical usage                   |
|-----------|-------------------------|---------------------------------|
| `"..."`   | Forbidden (use `\n`)    | JSON-compatible, short strings  |
| `'...'`   | Forbidden (use `\n`)    | Strings containing `"`          |
| `` `...` `` | **Preserved verbatim**  | Multi-line text (SQL, prompts…) |

All three use the **same** escape vocabulary.

## Escape sequences

| Escape      | Produces                                       |
|-------------|------------------------------------------------|
| `\'`        | `'`                                            |
| `\"`        | `"`                                            |
| `` \` ``    | `` ` ``                                        |
| `\\`        | `\`                                            |
| `\b`        | Backspace (U+0008)                             |
| `\f`        | Form feed (U+000C)                             |
| `\n`        | Line feed (U+000A)                             |
| `\r`        | Carriage return (U+000D)                       |
| `\t`        | Tab (U+0009)                                   |
| `\v`        | Vertical tab (U+000B)                          |
| `\0`        | NUL (U+0000) — not allowed before a digit      |
| `\xHH`      | Hex escape, two hex digits                     |
| `\uHHHH`    | Unicode escape, four hex digits                |
| `\u{H...H}` | Unicode escape, 1–6 hex digits, ≤ U+10FFFF     |

Any other sequence (`\q`, `\z`, …) raises `EdenSyntaxError`. Legacy
octal escapes (`\00`, `\12`, …) are rejected.

## Line continuation

A backslash immediately followed by a line terminator is consumed as a
**line continuation**: neither the backslash nor the terminator appears
in the resulting string. This lets you wrap long literals without
inserting a line break.

```eden
{
    sql: "SELECT * \
FROM users",
}
```

Line continuation is available in all three delimiter styles (though
it is rarely needed inside template literals, which are already
multi-line).

## `${...}` in templates — always verbatim

> ⚠️ **This is the one place where eden diverges from JavaScript.**

In JavaScript, a template literal evaluates any `${expression}` inside
its body. **eden never does this.** The sequence is preserved as
literal text.

```eden
{
    greeting: `Hello ${name}, welcome!`,
}
```

After `eden.parse(...)`, the value of `greeting` is the 28-character
string `Hello ${name}, welcome!` — **exactly** what is written, `$`,
`{`, `}` and all.

### Why

eden is a **data-interchange format**, not a runtime. The parser must
be safe on untrusted input, and eden is portable across languages (a
PHP port shares the same conformance fixtures). Interpolating
`${expression}` would mean executing code at parse time, which breaks
both guarantees.

### What this is good for

Templates are the obvious home for text that will be rendered later by
**another** system — Mustache, Handlebars, lodash.template, shell
`envsubst`, prompt builders for LLMs, and so on. eden carries the text
untouched to the consumer, and the consumer does the interpolation
with its own rules.

Examples:

```eden
{
    // A SQL query with placeholders resolved later by your DB driver
    // or by a templating engine that uses ${...} as its syntax.
    sqlInsert: `INSERT INTO users (name, email)
                VALUES (${name}, ${email})`,

    // A prompt template fed into an LLM renderer that knows about ${...}.
    promptTemplate: `Summarize the following text:
                     ---
                     ${input}
                     ---`,

    // A shell script snippet consumed by envsubst.
    envPreamble: `export VERSION=${VERSION}
                  export BUILD=${BUILD_NUMBER}`,
}
```

If `eden.parse()` raised an error on `${...}`, none of the above would
be expressible as multi-line literals.

### What if I wanted eden itself to interpolate?

It will not. Not in a future version either. eden stays a data format
— interpolation belongs to the consuming application, not to the
format. If you want eden to resolve variables, pipe the parsed value
through a templating engine of your choice.

## Related

- Grammar reference: [`SPEC.md` §2.9](../../SPEC.md) (strings) and
  [`SPEC.md` §2.10](../../SPEC.md) (templates)
- Lexer behaviour: [`ARCHITECTURE.md` §3](../../ARCHITECTURE.md)
