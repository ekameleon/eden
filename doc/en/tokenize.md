# `tokenize` — the low-level lexer entry point

`tokenize(source, options?)` returns the **raw token stream** for an
eden source. It is the lowest-level public entry point eden offers;
most consumers should reach for [`parse`](./data-mode.md) or
[`evaluate`](./evaluation-mode.md) instead. The token stream is
exposed for tooling that needs character-level information:

- syntax highlighters (e.g. VS Code grammars),
- code mirror modes,
- linters that need lookahead beyond what the parser keeps,
- documentation generators that surface comments verbatim.

## Usage

```js
import { tokenize, TokenType } from "@ekameleon/eden";

const tokens = tokenize(`{ name: "Marc" }`);
// [
//     { type: "PUNCTUATOR",  value: "{",       offset:  0, line: 1, column:  1 },
//     { type: "IDENTIFIER",  value: "name",    offset:  2, line: 1, column:  3 },
//     { type: "PUNCTUATOR",  value: ":",       offset:  6, line: 1, column:  7 },
//     { type: "STRING",      value: "\"Marc\"", offset:  8, line: 1, column:  9 },
//     { type: "PUNCTUATOR",  value: "}",       offset: 15, line: 1, column: 16 },
//     { type: "EOF",         value: "",        offset: 16, line: 1, column: 17 },
// ]
```

Every token carries:

| Field    | Meaning                                                |
|----------|--------------------------------------------------------|
| `type`   | One of the `TokenType.*` constants (string discriminator). |
| `value`  | The raw lexeme as it appears in the source (including delimiters for strings, the `n` suffix for BigInts, etc.). |
| `offset` | Zero-based offset of the first character in the source. |
| `line`   | One-based line number.                                 |
| `column` | One-based column number.                               |

The stream always ends with an `EOF` token.

## `TokenType`

```js
import { TokenType } from "@ekameleon/eden";
```

Frozen object listing every token type produced by the lexer:

```
PUNCTUATOR    KEYWORD       IDENTIFIER
NUMBER        BIGINT        STRING        TEMPLATE
LINE_COMMENT  BLOCK_COMMENT
EOF
```

Comments are emitted as tokens (`LINE_COMMENT`, `BLOCK_COMMENT`) so
tools that care about them can find them; the parser skips them
internally.

## Lexer guarantees

- **No I/O.** The lexer is pure; given the same string it returns the
  same token stream.
- **No scope awareness.** The lexer does not know about identifiers
  declared by the user or by the security policy. It only enforces
  the **lexical** grammar.
- **All errors are `EdenSyntaxError`.** Unterminated strings, illegal
  escapes, unterminated block comments, and the rest all raise the
  same class with a precise `{ line, column, offset }`.

## Example — counting comments

```js
import { tokenize, TokenType } from "@ekameleon/eden";

const tokens = tokenize(source);
const comments = tokens.filter((t) =>
    t.type === TokenType.LINE_COMMENT || t.type === TokenType.BLOCK_COMMENT
);
console.log(`${comments.length} comments`);
```

## Example — a minimal syntax highlighter

```js
function highlight(source) {
    const out = [];
    let cursor = 0;
    for (const token of tokenize(source)) {
        if (token.type === TokenType.EOF) break;
        out.push(source.slice(cursor, token.offset));   // whitespace
        out.push(`<span class="tok-${token.type.toLowerCase()}">${escape(token.value)}</span>`);
        cursor = token.offset + token.value.length;
    }
    return out.join("");
}
```

## Related

- [Errors](./errors.md)
- [AST reference](./ast-reference.md)
- Grammar reference: [`SPEC.md §2`](../../SPEC.md)
- Architecture reference: [`ARCHITECTURE.md §3`](../../ARCHITECTURE.md) (token shape)
