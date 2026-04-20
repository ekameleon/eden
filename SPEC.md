# eden — Specification

**eden** (ECMAScript Data Exchange Notation) is a superset of JSON designed
as a human-friendly data-interchange format. It borrows syntax from modern
ECMAScript (ES2022) to provide:

- unquoted identifier keys
- single / double / template string quotes
- comments
- trailing commas
- `NaN`, `Infinity`, `undefined`, `BigInt` literals
- optional constructor and function call semantics (evaluation mode)

This document defines the grammar and semantics normatively.
The JavaScript implementation in this repository and the future PHP port
both conform to this specification.

---

## 1. Two modes

eden is parsed and used through two distinct entry points with different
capabilities.

### 1.1 Data mode — `eden.parse` / `eden.stringify`

Pure data serialization. Drop-in upgrade from `JSON.parse` / `JSON.stringify`.

- No scope, no identifier resolution, no function calls, no `new`.
- Only literals, arrays, objects, and unary `+`/`-` on numeric values.
- Safe by default. Can be used on untrusted input without side effects
  on the host environment.

### 1.2 Evaluation mode — `eden.evaluate`

Full execution of an eden program.

- Requires an explicit `scope` and `policy`.
- Supports identifier resolution, member paths, `new` expressions,
  function calls, and assignment statements.
- Every access is checked against the security policy.

**Any feature that requires a runtime scope belongs only to evaluation mode.**

---

## 2. Lexical grammar

### 2.1 Source text

Source text is a sequence of Unicode code points encoded as UTF-8.
A source MUST be valid UTF-8; otherwise the parser raises `EdenSyntaxError`.

### 2.2 White space

```
WhiteSpace ::= U+0009 | U+000B | U+000C | U+0020 | U+00A0
             | U+FEFF | <other Unicode "Space_Separator">
```

White space separates tokens but is otherwise insignificant.

### 2.3 Line terminators

```
LineTerminator ::= U+000A | U+000D | U+2028 | U+2029
```

### 2.4 Comments

```
Comment     ::= LineComment | BlockComment
LineComment ::= "//" { SourceChar - LineTerminator }
BlockComment ::= "/*" { SourceChar } "*/"
```

Block comments do not nest. An unterminated block comment raises
`EdenSyntaxError`.

### 2.5 Tokens

```
Token ::= Punctuator
        | Keyword
        | Identifier
        | NumericLiteral
        | BigIntLiteral
        | StringLiteral
        | TemplateLiteral

Punctuator ::= "{" | "}" | "[" | "]" | "(" | ")"
             | "," | ":" | ";" | "." | "=" | "+" | "-"
             | "..."
```

### 2.6 Reserved words

The following identifiers have fixed meanings and cannot be used as
user-defined identifiers:

- **Value keywords:** `null`, `true`, `false`, `undefined`,
  `NaN`, `Infinity`
- **Operation keywords (evaluation mode only):** `new`

All other ECMAScript reserved words (`class`, `function`, `return`, etc.)
are rejected as identifiers to keep forward-compatibility.

### 2.7 Identifiers

```
Identifier      ::= IdentifierStart { IdentifierPart }
IdentifierStart ::= UnicodeLetter | "_" | "$"
IdentifierPart  ::= IdentifierStart | UnicodeDigit
```

`UnicodeLetter` and `UnicodeDigit` follow the Unicode
`ID_Start` / `ID_Continue` classes as in ECMAScript.

### 2.8 Numeric literals

```
NumericLiteral ::= DecimalLiteral | HexLiteral | OctalLiteral | BinaryLiteral

DecimalLiteral ::= DecimalInt [ "." DecimalDigits ] [ ExponentPart ]
                 | "." DecimalDigits [ ExponentPart ]
DecimalInt     ::= "0" | NonZeroDigit { DecimalDigit | "_" DecimalDigit }
ExponentPart   ::= ("e" | "E") [ "+" | "-" ] DecimalDigits

HexLiteral     ::= "0" ("x" | "X") HexDigit { HexDigit | "_" HexDigit }
OctalLiteral   ::= "0" ("o" | "O") OctalDigit { OctalDigit | "_" OctalDigit }
BinaryLiteral  ::= "0" ("b" | "B") BinaryDigit { BinaryDigit | "_" BinaryDigit }

BigIntLiteral  ::= ( DecimalInt | HexLiteral | OctalLiteral | BinaryLiteral ) "n"
```

Numeric separators (`_`) are allowed between digits for readability.
They have no semantic effect.

Legacy ECMAScript octals (`0777` with no `o` prefix) are **not** supported —
use the explicit `0o` prefix.

### 2.9 String literals

```
StringLiteral       ::= '"' { DoubleStringChar } '"'
                      | "'" { SingleStringChar } "'"

DoubleStringChar    ::= SourceChar - ('"' | "\" | LineTerminator)
                      | LineContinuation
                      | EscapeSequence

SingleStringChar    ::= SourceChar - ("'" | "\" | LineTerminator)
                      | LineContinuation
                      | EscapeSequence

LineContinuation    ::= "\" LineTerminator
EscapeSequence      ::= "\" ( SingleEscape | UnicodeEscape | HexEscape )
SingleEscape        ::= "'" | '"' | "`" | "\" | "b" | "f" | "n" | "r" | "t" | "v" | "0"
UnicodeEscape       ::= "u" HexDigit HexDigit HexDigit HexDigit
                      | "u{" HexDigit { HexDigit } "}"
HexEscape           ::= "x" HexDigit HexDigit
```

### 2.10 Template literals

```
TemplateLiteral ::= "`" { TemplateChar } "`"
TemplateChar    ::= SourceChar - ("`" | "\")
                  | EscapeSequence
```

Template literals behave as multi-line strings. Literal line terminators
inside a template are preserved verbatim.

**Templates never interpolate.** The sequence `${...}` is preserved
verbatim as part of the string content. eden is a data-interchange
format, not a runtime — `${...}` is a passthrough payload that
downstream consumers (Mustache, lodash, Handlebars, shell templating,
prompt renderers, ...) may interpret with their own rules, but eden
itself never evaluates it.

---

## 3. Syntactic grammar

### 3.1 Program (data mode)

```
DataProgram ::= Value
Value       ::= Null | Undefined | Boolean | Number | BigInt | String
              | Array | Object | UnaryValue
UnaryValue  ::= ( "+" | "-" ) ( Number | BigInt )
```

A data-mode source contains **exactly one value**.
Trailing white space and comments are ignored. Any extra token raises
`EdenSyntaxError`.

### 3.2 Program (evaluation mode)

```
EvalProgram ::= { Statement }
Statement   ::= ( Assignment | Expression ) [ ";" ]
Assignment  ::= MemberPath "=" Expression
```

Statements are separated by `;`, a line terminator, or end of input.
The program result is the value of the last expression evaluated, or
`undefined` if the program contains only assignments.

### 3.3 Expressions (evaluation mode)

```
Expression     ::= Literal
                 | Array
                 | Object
                 | NewExpression
                 | CallExpression
                 | MemberPath
                 | UnaryExpression

UnaryExpression ::= ( "+" | "-" ) Expression

NewExpression   ::= "new" MemberPath [ Arguments ]
CallExpression  ::= MemberPath Arguments
Arguments       ::= "(" [ Expression { "," Expression } [ "," ] ] ")"

MemberPath      ::= Identifier { MemberAccess }
MemberAccess    ::= "." Identifier
                  | "[" ( StringLiteral | NumericLiteral ) "]"
```

### 3.4 Arrays

```
Array       ::= "[" [ Element { "," Element } [ "," ] ] "]"
Element     ::= Expression            (evaluation mode)
              | Value                 (data mode)
```

Elisions (`[1, , 3]`) are **not** supported. Use `undefined` or `null`
explicitly.

### 3.5 Objects

```
Object      ::= "{" [ Property { "," Property } [ "," ] ] "}"
Property    ::= PropertyKey ":" PropertyValue                  (long form)
              | Identifier                                     (shorthand, eval only)
              | "[" Expression "]" ":" PropertyValue           (computed, eval only)

PropertyKey ::= Identifier | StringLiteral | NumericLiteral
PropertyValue ::= Value                  (data mode)
                | Expression             (evaluation mode)
```

**Shorthand properties** and **computed keys** are legal in evaluation mode
only. In data mode they raise `EdenSyntaxError`.

Duplicate keys: the **last definition wins**, matching ECMAScript object
literal semantics. A warning is emitted in strict mode.

---

## 4. Literal semantics

### 4.1 Null & undefined

`null` parses to the JavaScript `null`.
`undefined` parses to the JavaScript `undefined`.

### 4.2 Booleans

`true` and `false` parse to the JavaScript booleans.

### 4.3 Numbers

All numeric literals parse to IEEE-754 double-precision `Number`, with
these special cases:

| Source        | Result                    |
|---------------|---------------------------|
| `NaN`         | `Number.NaN`              |
| `Infinity`    | `Number.POSITIVE_INFINITY`|
| `-Infinity`   | `Number.NEGATIVE_INFINITY`|

### 4.4 BigInts

A numeric literal suffixed with `n` produces a `BigInt`. BigInts cannot
have a fractional part or an exponent (same as ECMAScript).

### 4.5 Strings

String and template literals parse to JavaScript `String`. Escape sequences
follow the ECMAScript 2022 definitions.

---

## 5. Evaluation semantics

### 5.1 Scope

An evaluation takes an `options.scope` object. Identifier resolution walks
paths on this object. `_global` is **not** a special identifier in eden —
the scope object is the root.

### 5.2 Assignments

`foo.bar = expr` creates missing intermediate objects as needed and assigns
the evaluated `expr` to the final path component. An assignment statement
evaluates to the assigned value.

### 5.3 `new` expressions

`new Path(args)` resolves `Path` on the scope, checks it against the
security policy, and invokes it as a constructor with the evaluated
arguments. Missing or non-callable paths raise `EdenReferenceError`.

### 5.4 Function calls

`Path(args)` resolves `Path`, checks the security policy, and invokes the
function. Member-style calls (`obj.method(args)`) are invoked with `obj`
as `this`.

### 5.5 Security policy

See `ARCHITECTURE.md §6` for the policy object shape. The policy is
**fail-closed**: any path not explicitly authorized is rejected with
`EdenSecurityError`.

---

## 6. JSON compatibility

Every valid JSON document is a valid eden document, with identical
semantics. `eden.parse` accepts any input that `JSON.parse` accepts and
returns the same value.

### 6.1 Stringify compatibility

`eden.stringify(value, { jsonCompatible: true })` produces output that
`JSON.parse` can consume. In this mode:

- `undefined` values are dropped from objects and replaced by `null` in arrays
- `NaN` and `Infinity` are serialized as `null`
- `BigInt` raises `TypeError` (as JSON does)
- Object keys are always double-quoted
- Template literals are never produced
- Trailing commas are never produced
- Comments are never produced

---

## 7. Examples

### 7.1 JSON-like

```eden
{
    "name": "Marc",
    "active": true,
    "tags": ["dev", "maker"]
}
```

### 7.2 Idiomatic eden

```eden
{
    // unquoted keys, trailing commas, comments
    name: "Marc",
    active: true,
    tags: ["dev", "maker",],
    lines: `line 1
line 2
line 3`,
    big: 9007199254740993n,
    nothing: undefined,
    weirdKey: "you can still quote if you want",
    "key with spaces": 42,
    0: "numeric keys allowed",
}
```

### 7.3 Evaluation mode

```eden
// runs only through eden.evaluate()
user = {
    name: "Marc",
    joined: new Date("2024-01-15"),
}

user.active = true
```

### 7.4 Security: data mode rejects unsafe constructs

```
// eden.parse() on this source raises EdenSyntaxError:
new Date("2024-01-15")

// eden.parse() on this source raises EdenSyntaxError (identifier ref):
user
```

---

## 8. Errors

| Class                | Raised when                                       |
|----------------------|---------------------------------------------------|
| `EdenSyntaxError`    | Malformed source                                  |
| `EdenReferenceError` | Identifier/path not found in scope (eval only)    |
| `EdenSecurityError`  | Access denied by the policy (eval only)           |
| `EdenTypeError`      | Operation applied to a value of the wrong type    |

All eden errors extend `EdenError`, which extends the native `Error`.
Every error carries `{ line, column, offset }` when raised from a source
location.

---

## 9. MIME & file extension

- Extension: `.eden`
- Primary MIME: `application/eden`
- Alias: `text/eden` (recommended for servers that need a `text/*` type)

---

## 10. Versioning

This is **eden specification v1.0**. Non-breaking additions increment the
minor version. Breaking changes to the grammar or runtime semantics require
a new major version and a corresponding bump of the library.