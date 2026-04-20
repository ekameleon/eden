# Lexer conformance fixtures

Negative fixtures for the lexer live in this folder. Each fixture is a
pair of files sharing the same base name:

```
NNN-short-description.eden        ← source text that must fail to tokenize
NNN-short-description.error.json  ← descriptor of the expected error
```

- `NNN` is a three-digit sequence number used only for ordering.
- `short-description` is a lowercase, hyphen-separated hint for humans
  (`unterminated-block-comment`, `bad-numeric-separator`, ...).

## Error descriptor schema

The `.error.json` file holds a single JSON object with the following
shape:

```json
{
    "class":   "EdenSyntaxError",
    "message": "unterminated block comment",
    "line":    3,
    "column":  5,
    "offset":  42
}
```

| Field     | Kind     | Matching rule                                                                                         |
|-----------|----------|--------------------------------------------------------------------------------------------------------|
| `class`   | required | Name of the error class the lexer must throw (one of the `Eden*Error` classes, usually `EdenSyntaxError`). |
| `message` | required | Case-insensitive **substring** match against the thrown error's `message`. Keep fragments short and stable. |
| `line`    | required | Strict equality with the thrown error's `line` (one-based).                                           |
| `column`  | required | Strict equality with the thrown error's `column` (one-based).                                         |
| `offset`  | required | Strict equality with the thrown error's `offset` (zero-based).                                        |

The substring match on `message` is deliberate: it lets us refine the
phrasing of an error over time without invalidating dozens of fixtures.
Make the substring specific enough to pin down the error, generic
enough to survive minor wording changes (`unterminated block comment`
is fine; `Unterminated block comment: expected "*/" before EOF` is
too brittle).

## Authoring workflow

1. Add the `.eden` source and the matching `.error.json` in the same
   commit as the lexer change that makes them fail the way you expect.
2. Run `bun test` — the conformance harness picks up new pairs
   automatically (once the lexer-fixture harness lands in a later
   sub-step of issue #2).
3. Keep fixtures minimal: one failure per fixture, no unrelated
   syntax noise.

## Positive fixtures

Positive fixtures (sources that must tokenize successfully) live next
to the parse fixtures in [`../parse/`](../parse) because they are also
useful cross-language. If a lexer-only positive fixture is ever
needed, we will introduce a dedicated `valid/` subfolder here and
document it in this README.
