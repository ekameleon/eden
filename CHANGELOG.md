# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-21

First public release. Ships the full grammar, the data-mode and
eval-mode pipelines, JSON interop, a benchmark harness, and the
human documentation in English and French.

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
- Evaluator surface: full AST evaluation against a runtime
  `scope` with a `SecurityPolicy` gating function calls and
  constructors. Reads (`Identifier`, `MemberExpression`) walk
  the scope and raise `EdenReferenceError` on missing paths or
  descents through `null` / `undefined`; primitives are
  auto-boxed so `"hello".length` resolves transparently.
  Invocations (`CallExpression`, `NewExpression`) consult the
  policy's `authorized` glob list (exact paths or one-or-more-
  segment suffix wildcards such as `"Math.*"`), respect the
  `allowFunctionCall` / `allowConstructor` flags, and on denial
  fire the `onDenied` hook before returning the configured
  `undefineable` value (default `undefined`).
  `AssignmentStatement` walks the path on the scope, creating
  missing intermediates as needed per SPEC §5.2; writing through
  a primitive intermediate surfaces the native `TypeError`.
  Composites (`ArrayExpression`, `ObjectExpression`,
  `UnaryExpression`) walk their sub-nodes left-to-right;
  `ObjectExpression` handles the three property shapes —
  longhand, shorthand, and computed (key coerced through
  `String(...)`). Multi-statement eval-mode programs yield the
  value of the last non-assignment expression per SPEC §3.2.
  `EdenReferenceError` and `EdenSecurityError` are re-exported
  from the public façade; the `Evaluator`, `Scope`,
  `SecurityPolicy` and internal `evalAST` helpers stay private
  until the public `evaluate()` entry point lands (#6).
- Public `evaluate(source, options?)` entry point. The function
  parses `source` in eval mode (any caller-supplied `mode` is
  silently overridden) and walks the AST against the runtime
  `scope` and `policy` carried by `options`. `ParseOptions` and
  `EvaluateOptions` share the same options bag and are forwarded
  to their respective consumers (#7).
- Documentation tree expanded under [`doc/en/`](./doc/en) and
  [`doc/fr/`](./doc/fr): one focused page per public feature
  (data mode, stringify, evaluation mode, security policy, JSON
  interop, numbers, objects and arrays, comments, errors,
  tokenize, AST reference). The English and French trees are
  kept in strict parity. The root `README.md` gets a
  Performance section, a Tooling APIs section, an Errors
  section, and the roadmap moves to a dedicated
  [`ROADMAP.md`](./ROADMAP.md) (#10).

[Unreleased]: https://github.com/ekameleon/eden/compare/0.1.0...HEAD
[0.1.0]: https://github.com/ekameleon/eden/releases/tag/0.1.0
