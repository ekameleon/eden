# eden

**ECMAScript Data Exchange Notation** — a human-friendly data format that picks up where JSON stops.

```eden
{
    // comments are allowed
    name: "Marc",                 // unquoted keys
    tags: ["dev", "maker",],      // trailing commas
    lines: `multi-line
string literal`,
    big: 9007199254740993n,       // BigInt
    nothing: undefined,
    "with spaces": true,
}
```

Every valid JSON document is a valid eden document. eden is a strict superset.

---

## Why

JSON is great for machines, painful for humans. YAML is readable but brittle.
TOML is fine for flat configs and awkward for nested data. eden sits in the
middle: the readability of a modern JavaScript object literal, without being
a full scripting language.

## Features

- **Drop-in JSON replacement** — `eden.parse` reads any JSON file unchanged
- Unquoted identifier keys, single / double / template string quotes
- Line and block comments
- Trailing commas everywhere
- `NaN`, `Infinity`, `undefined`, `BigInt` literals
- Multi-line template strings (no interpolation — eden is data, not code)
- Zero runtime dependencies
- Available as ESM, CommonJS, IIFE, and minified IIFE for CDN usage
- Generated TypeScript declarations — usable from TS without being written in TS
- Optional **evaluation mode** for configs that benefit from `new Date(...)`
  or scoped assignments, with a strict security policy

## Installation

```bash
npm install @ekameleon/eden
# or
bun add @ekameleon/eden
```

### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@ekameleon/eden"></script>
<script>
    const data = eden.parse(source);
</script>
```

## Usage

### Data mode (safe by default)

```js
import { parse, stringify } from "@ekameleon/eden";

const value = parse(`{
    name: "Marc",
    tags: ["dev", "maker",],
}`);

const text = stringify(value, { indent: 4, unquotedKeys: true });
```

### Evaluation mode (opt-in, scoped)

```js
import { evaluate } from "@ekameleon/eden";

const result = evaluate(
    `user = { name: "Marc", joined: new Date("2024-01-15") }`,
    {
        scope:  {},
        policy: {
            allowConstructor: true,
            authorized:       ["Date"],
        },
    },
);
```

### Convert to / from JSON

```js
import { toJSON, fromJSON } from "@ekameleon/eden";

const jsonText = toJSON(edenValue, { jsonCompatible: true });
const edenText = fromJSON(jsonSource);
```

## API

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full public API and
option reference.

## Documentation

Full end-user documentation lives under [`doc/`](./doc):

- English: [`doc/en/`](./doc/en)
- Français : [`doc/fr/`](./doc/fr)

The two trees are kept in sync. `SPEC.md` and `ARCHITECTURE.md` remain
the authoritative references for the grammar and the implementation.

## Development

eden is built and tested with [Bun](https://bun.sh) (≥ 1.1). Node 18+ is
required only because `tsc` (used to generate the `.d.ts`) runs on Node.

```bash
bun install
bun test              # run the full test suite
bun test --watch      # rerun on file changes
bun run build         # emit dist/eden.{mjs,cjs,js,min.js,d.ts}
```

### Conformance fixtures

The `test/` directory holds unit tests per module **and** a conformance
harness at [`test/conformance.test.js`](./test/conformance.test.js).
The harness auto-discovers every fixture under `test/fixtures/parse/`
and checks that `parse(<eden source>)` deep-equals the value encoded in
the matching `.json` file.

Adding a new conformance fixture is a two-file drop:

```
test/fixtures/parse/042-my-feature.eden   ← eden source text
test/fixtures/parse/042-my-feature.json   ← expected value, JSON-encoded
```

No change to the harness or to any registry is required — the next
`bun test` will pick it up.

These fixtures are the source of truth shared with the future PHP port,
so please keep them minimal, focused on one feature each, and stable.

## Grammar

- [`SPEC.md`](./SPEC.md) — normative grammar and semantics (prose form)
- [`eden.abnf`](./eden.abnf) — machine-readable companion grammar
  (ABNF, RFC 5234 + RFC 7405)

## File association

- Extension: `.eden`
- MIME type: `application/eden` (alias: `text/eden`)

## Roadmap

- [x] Specification (grammar + semantics)
- [x] Lexer
- [x] Parser + AST
- [ ] Serializer
- [ ] `parse` / `stringify` public API
- [ ] Evaluator with scope & security policy
- [ ] `evaluate` public API
- [ ] JSON convertors
- [ ] Benchmarks vs `JSON.parse`
- [ ] PHP port (same conformance fixtures)
- [ ] VS Code syntax highlighting
- [ ] LSP (formatter + linter)

## History

eden was originally created by Zwetan Kjukov between 2004 and 2006 as
part of the *buRRRn* project. This modern rewrite preserves the
specification's spirit while modernizing the codebase (ES2022, zero
dependencies, reusable across JS runtimes) and formalizing the grammar
for cross-language ports.

## License

MPL 2.0 (matching the original eden, upgraded from MPL 1.1).

## Credits

- Original design and reference implementation: Zwetan Kjukov and Marc Alcaraz
- Modern rewrite: Marc Alcaraz — [ekameleon.net](https://www.ekameleon.net)