# eden — Architecture

This document describes the internal structure of the eden JavaScript
implementation: module layout, AST node shapes, public API signatures,
options, and error model.

It complements `SPEC.md` (which defines the *language*) by documenting
the *implementation*.

---

## 1. Project layout

```
eden/
├── CLAUDE.md                   ← rules for Claude Code sessions
├── SPEC.md                     ← normative grammar and semantics
├── ARCHITECTURE.md             ← this file
├── README.md
├── LICENSE
├── package.json
├── tsconfig.build.json         ← .d.ts generation only
├── bunfig.toml
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── index.js                ← public façade (parse, stringify, evaluate, ...)
│   ├── lexer/
│   │   ├── Lexer.js
│   │   ├── createToken.js
│   │   ├── tokenize.js
│   │   ├── TokenType.js
│   │   └── keywords/
│   │       ├── edenValueKeywords.js
│   │       ├── edenOperationKeywords.js
│   │       └── ecmascriptReservedWords.js
│   ├── parser/
│   │   ├── Parser.js
│   │   └── ast/
│   │       ├── Node.js
│   │       ├── Literal.js
│   │       ├── ArrayExpression.js
│   │       ├── ObjectExpression.js
│   │       ├── Property.js
│   │       ├── Identifier.js
│   │       ├── MemberExpression.js
│   │       ├── UnaryExpression.js
│   │       ├── CallExpression.js
│   │       ├── NewExpression.js
│   │       ├── AssignmentStatement.js
│   │       └── Program.js
│   ├── evaluator/
│   │   ├── Evaluator.js
│   │   ├── Scope.js
│   │   └── SecurityPolicy.js
│   ├── serializer/
│   │   ├── Serializer.js
│   │   └── quoting.js
│   ├── convert/
│   │   ├── fromJSON.js
│   │   └── toJSON.js
│   ├── errors/
│   │   ├── EdenError.js
│   │   ├── EdenSyntaxError.js
│   │   ├── EdenReferenceError.js
│   │   ├── EdenSecurityError.js
│   │   └── EdenTypeError.js
│   └── util/
│       ├── isIdentifierStart.js   ← ID_Start helper
│       └── isIdentifierPart.js    ← ID_Continue helper
├── test/
│   ├── lexer.test.js
│   ├── parser.test.js
│   ├── serializer.test.js
│   ├── evaluator.test.js
│   ├── convert.test.js
│   ├── conformance.test.js     ← runs all fixtures
│   └── fixtures/
│       ├── parse/
│       │   ├── 001-empty-object.eden
│       │   ├── 001-empty-object.json        ← expected result
│       │   └── ...
│       ├── stringify/
│       └── evaluate/
├── bench/
│   ├── run.js
│   └── cases/
└── dist/                       ← generated, gitignored
    ├── eden.mjs
    ├── eden.cjs
    ├── eden.js                 ← IIFE, global `eden`
    ├── eden.min.js             ← IIFE minified
    └── eden.d.ts
```

---

## 2. Module responsibilities

### 2.1 `lexer/`

Consumes a source string and produces a stream of `Token` objects.
Pure, deterministic, side-effect free. Does not care about semantics —
it only segments the input into lexical units and reports lexical errors.

### 2.2 `parser/`

Consumes tokens and produces an **AST**. Enforces the syntactic grammar
from `SPEC.md §3`. The parser is aware of the current mode (`data` vs
`eval`) and rejects constructs illegal in that mode.

### 2.3 `serializer/`

Consumes either a runtime value or an AST and produces an eden (or JSON)
source string. Never evaluates, never resolves identifiers.

### 2.4 `evaluator/`

Consumes an AST plus a `Scope` and a `SecurityPolicy` and produces a
runtime value. This is the **only** module that touches the host
environment.

### 2.5 `convert/`

Utilities to convert between eden and JSON representations. `fromJSON` is
trivial (JSON is a strict subset). `toJSON` walks an eden value, lossily
downgrading unsupported constructs according to `jsonCompatible` rules.

### 2.6 `errors/`

All eden error types. Each extends `EdenError`, which extends `Error`.

---

## 3. Token shape

```js
/**
 * @typedef {object} Token
 * @property {TokenType} type     - One of the constants in TokenType.
 * @property {string}    value    - Raw lexeme as it appears in the source.
 * @property {number}    offset   - Zero-based index of the first character.
 * @property {number}    line     - One-based line number.
 * @property {number}    column   - One-based column number.
 */
```

`TokenType` is a frozen object of string constants:

```
PUNCTUATOR, KEYWORD, IDENTIFIER,
NUMBER, BIGINT, STRING, TEMPLATE,
LINE_COMMENT, BLOCK_COMMENT,
EOF
```

Comments are preserved as tokens but skipped by the parser. They remain
available for tools (formatters, linters) that consume the raw stream.

---

## 4. AST node shapes

All nodes share a common base:

```js
/**
 * @typedef {object} Node
 * @property {string} type         - Discriminator, e.g. "Literal".
 * @property {number} [offset]     - Source offset of the first character.
 * @property {number} [line]
 * @property {number} [column]
 */
```

### 4.1 Literal

```js
{
    type: "Literal",
    value: null | undefined | boolean | number | bigint | string,
    raw:   "...",             // original source lexeme
    kind:  "null" | "undefined" | "boolean" | "number" | "bigint"
         | "string" | "template"
}
```

### 4.2 Identifier

```js
{ type: "Identifier", name: "foo" }
```

### 4.3 MemberExpression

```js
{
    type: "MemberExpression",
    object:   Node,
    property: Identifier | Literal,
    computed: boolean          // true for obj["x"], false for obj.x
}
```

### 4.4 ArrayExpression

```js
{ type: "ArrayExpression", elements: Node[] }
```

### 4.5 ObjectExpression

```js
{ type: "ObjectExpression", properties: Property[] }
```

### 4.6 Property

```js
{
    type: "Property",
    key:       Identifier | Literal | Node,   // Node when computed
    value:     Node,
    shorthand: boolean,
    computed:  boolean
}
```

### 4.7 UnaryExpression

```js
{
    type: "UnaryExpression",
    operator: "+" | "-",
    argument: Node
}
```

### 4.8 CallExpression

```js
{
    type: "CallExpression",
    callee:    Node,          // Identifier or MemberExpression
    arguments: Node[]
}
```

### 4.9 NewExpression

```js
{
    type: "NewExpression",
    callee:    Node,
    arguments: Node[]
}
```

### 4.10 AssignmentStatement

```js
{
    type: "AssignmentStatement",
    target: Identifier | MemberExpression,
    value:  Node
}
```

### 4.11 Program

```js
{
    type: "Program",
    mode: "data" | "eval",
    body: Node[]
}
```

In `data` mode, `body` contains exactly one node.

> The shapes above are intentionally close to ESTree, with eden-specific
> additions (`Literal.kind`, `AssignmentStatement`). This lets tools
> written for ESTree be adapted to eden with minimal effort.

---

## 5. Public API

All exports from `src/index.js`. These are the **only** public entry points.

### 5.1 `parse(source, options?)`

```js
/**
 * Parses a data-mode eden source and returns the resulting value.
 *
 * @param   {string}      source    - eden source text.
 * @param   {ParseOptions} [options]
 * @returns {*}           The parsed value.
 * @throws  {EdenSyntaxError}
 */
export function parse( source, options )
```

### 5.2 `stringify(value, options?)`

```js
/**
 * Serializes a JavaScript value as eden source.
 *
 * @param   {*}              value
 * @param   {StringifyOptions} [options]
 * @returns {string}
 * @throws  {EdenTypeError}
 */
export function stringify( value, options )
```

### 5.3 `evaluate(source, options?)`

```js
/**
 * Evaluates a full eden program against a scope.
 *
 * @param   {string}          source
 * @param   {EvaluateOptions} [options]
 * @returns {*}
 * @throws  {EdenSyntaxError | EdenReferenceError | EdenSecurityError | EdenTypeError}
 */
export function evaluate( source, options )
```

### 5.4 `fromJSON(jsonSource, options?)` / `toJSON(value, options?)`

```js
export function fromJSON( jsonSource, options )   // → string (eden)
export function toJSON( value, options )          // → string (JSON)
```

### 5.5 AST-level API

```js
export function parseToAST( source, options )     // → Program node
export function evalAST( ast, options )           // → value
export function stringifyAST( ast, options )      // → string
```

These are exported for tooling (formatters, LSP, linters).

### 5.6 Lower-level tokenizer

```js
export function tokenize( source, options )       // → Token[]
```

Useful for syntax highlighters.

---

## 6. Options

All option objects are plain objects with sensible defaults. Unknown keys
are ignored (forward compatibility).

### 6.1 `ParseOptions`

```js
{
    allowComments:       true,
    allowTrailingCommas: true,
    allowSingleQuotes:   true,
    allowUnquotedKeys:   true,
    allowTemplates:      true,
    allowBigInt:         true,
    strictMode:          true,
    maxDepth:            1024,         // safety guard against stack overflow
    maxStringLength:     Infinity
}
```

### 6.2 `StringifyOptions`

```js
{
    indent:          0,           // number of spaces, or a string
    quotes:          "double",    // "double" | "single"
    trailingCommas:  false,
    unquotedKeys:    true,        // eden default; false for JSON-compat
    sortKeys:        false,
    jsonCompatible:  false,       // forces strict JSON output
    replacer:        null         // (key, value) => replacement, JSON-like
}
```

### 6.3 `EvaluateOptions`

Extends `ParseOptions`, plus:

```js
{
    scope:  {},                   // root object for identifier resolution
    policy: {
        allowFunctionCall: false,
        allowConstructor:  true,
        authorized: [
            "Array", "Boolean", "Date", "Error",
            "Math.*", "Number.*", "Object", "String.*",
            "Infinity"
        ],
        undefineable: undefined,  // returned when a path is denied
        onDenied:     null        // optional (path) => void hook
    }
}
```

---

## 7. Error model

```
EdenError                ← base class, extends Error
├── EdenSyntaxError      ← lexer + parser failures
├── EdenReferenceError   ← evaluator: unknown identifier / path
├── EdenSecurityError    ← evaluator: denied by policy
└── EdenTypeError        ← evaluator: wrong type; serializer: non-serializable
```

Every error carries:

```js
{
    message: string,
    source:  string | null,
    offset:  number | null,
    line:    number | null,
    column:  number | null,
    cause:   Error | null
}
```

Error messages are in English (for logs and stack traces).
User-facing localization is the consumer's responsibility.

---

## 8. Build pipeline

Driven by Bun, declared in `package.json`:

| Script          | Output                             | Format | Target  |
|-----------------|------------------------------------|--------|---------|
| `build:esm`     | `dist/eden.mjs`                    | ESM    | browser |
| `build:cjs`     | `dist/eden.cjs`                    | CJS    | node    |
| `build:iife`    | `dist/eden.js`                     | IIFE   | browser |
| `build:min`     | `dist/eden.min.js`                 | IIFE   | browser (minified) |
| `build:dts`     | `dist/eden.d.ts`                   | —      | tsc     |

The IIFE build exposes a global named `eden`. The UMD format is
intentionally omitted — modern CDNs handle ESM, and UMD adds complexity
for a shrinking audience.

---

## 9. Testing strategy

- **Unit tests** per module (`lexer.test.js`, `parser.test.js`, etc.)
- **Round-trip tests**: for every fixture, assert
  `parse(stringify(parse(x))) ≡ parse(x)`.
- **Conformance tests**: the `test/fixtures/` directory is treated as the
  source of truth. The same fixtures will be run by the future PHP port
  to guarantee cross-language equivalence.
- **Negative tests**: malformed sources in `test/fixtures/invalid/` with
  expected error classes and approximate positions.

---

## 10. Implementation notes

- **No regex-based parsing** except for well-contained lexical helpers
  (e.g. a single regex per simple token type is fine). The main lexer
  is a hand-written character-level state machine. This matches the
  original eden and simplifies future PHP porting.
- **No `eval()`** in the implementation, ever. The evaluator walks the AST
  explicitly.
- **No `Function()` constructor**, ever.
- **Immutable AST nodes** — the parser produces nodes; no pass mutates them.
- **Unicode classes** are implemented via precomputed tables in
  `util/unicode.js`. Runtime dependency on `\p{ID_Start}` / `\p{ID_Continue}`
  regex is acceptable in JS; the PHP port will ship its own tables.