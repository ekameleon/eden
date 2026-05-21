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
