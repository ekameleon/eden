# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- CI workflow and conformance fixture harness (#1).
- Lexer per `SPEC.md §2` — full token coverage, identifier grammar,
  escape sequences, comments, template literals (#2).
- Parser per `SPEC.md §3` producing the complete eden AST (data + eval
  modes, every node type from `Literal` to `AssignmentStatement`) (#3).
- Formal ABNF grammar published alongside `SPEC.md` as `eden.abnf` (#11).
- Public `parse()` and `parseToAST()` entry points with the full
  `ParseOptions` surface (`allowComments`, `allowTrailingCommas`,
  `allowSingleQuotes`, `allowUnquotedKeys`, `allowTemplates`,
  `allowBigInt`, `allowEmptySource`, `strictMode`, `maxDepth`,
  `maxStringLength`).
- Public `stringify()` and `stringifyAST()` entry points covering the
  whole AST surface — scalar literals, strings and templates, arrays,
  plain objects, `UnaryExpression`, and every eval-mode node
  (`Identifier`, `MemberExpression`, `CallExpression`, `NewExpression`,
  `AssignmentStatement`, multi-statement `Program`, shorthand and
  computed `Property`). Supports `indent`, `quotes`, `unquotedKeys`,
  `sortKeys`, `trailingCommas`, `jsonCompatible`, `replacer`,
  `maxDepth`; detects circular runtime structures and raises a clear
  `EdenTypeError` instead of overflowing the stack (#4).
- Public API surface frozen and exercised by a dedicated smoke
  test suite (`test/api.test.js`): every export is asserted by
  shape, internal classes are confirmed hidden, and the two
  canonical round trips (`parse → stringify`, `parseToAST →
  stringifyAST`) are smoke-tested through the façade (#5).
- Zero-dependency micro-bench harness under `bench/`, runnable
  via `bun run bench`. Five representative cases — small object,
  medium nested document, large array, long string, eden-feature
  showcase — compare `eden.parse` / `eden.stringify` against
  `JSON.parse` / `JSON.stringify` and report ops/sec plus a
  ratio. Bench is manual: machine-dependent, no CI gating (#9).
- `fromJSON(jsonSource, options?)` and `toJSON(value, options?)`
  convenience utilities to convert between JSON and eden source
  strings without touching the lower-level entry points.
  `fromJSON` defers to native `JSON.parse` and re-emits via the
  eden serializer; malformed JSON raises `EdenSyntaxError` with
  the underlying `SyntaxError` preserved on the `cause` chain.
  `toJSON` always forces `jsonCompatible: true`, accepting (and
  silently neutralizing) any other `StringifyOptions` (#8).
