# Roadmap

This file tracks the larger phases of the eden project. Day-to-day
progress lives in the [`CHANGELOG.md`](./CHANGELOG.md); per-issue
detail is on [GitHub issues](https://github.com/ekameleon/eden/issues).

## v0.1.0 — first public release (2026-05-21)

- [x] Specification (grammar + normative semantics) — `SPEC.md`,
      formal ABNF in `eden.abnf` (#11)
- [x] CI workflow and conformance fixture harness (#1)
- [x] Lexer per `SPEC.md §2` (#2)
- [x] Parser + AST per `SPEC.md §3` (#3)
- [x] Serializer covering the full AST surface (#4)
- [x] Public `parse()` / `parseToAST()` / `stringify()` /
      `stringifyAST()` entry points (#5)
- [x] Evaluator with `Scope` and `SecurityPolicy` (#6)
- [x] Public `evaluate()` entry point (#7)
- [x] `fromJSON()` / `toJSON()` interop utilities (#8)
- [x] Zero-dependency benchmark harness vs native `JSON` (#9)
- [x] Documentation and v0.1.0 release (#10)

## Beyond v0.1.0

Ideas listed here are deliberate next steps, not commitments — order
and scope may change as feedback comes in.

- [ ] **PHP port** sharing the same `test/fixtures/` conformance suite,
      so eden documents round-trip identically across JavaScript and
      PHP.
- [ ] **VS Code syntax highlighting** — `.eden` file association,
      grammar definition, basic semantic highlighting.
- [ ] **Language server (LSP)** — formatter (driven by the existing
      serializer) and linter (driven by the existing lexer).
- [ ] **`evalAST()` public entry point** — currently internal; would
      let tooling skip the parse step when reusing an already-parsed
      AST.
- [ ] **Expanded conformance fixtures** — stringify-side and
      eval-side fixture suites, useful for the future PHP port.
- [ ] **Streaming parser** — incremental parsing for very large
      sources (long-tail use case; needs a real ask first).

## How to suggest a roadmap item

Open an issue with the `enhancement` label on
[github.com/ekameleon/eden](https://github.com/ekameleon/eden/issues).
Roadmap items are added here only after the corresponding issue exists
and has been triaged.
