# eden — Documentation (English)

This is the English documentation for the **eden** library.
The grammar and the runtime semantics are defined normatively in
[`SPEC.md`](../../SPEC.md); the public API and module layout are
described in [`ARCHITECTURE.md`](../../ARCHITECTURE.md). This tree
focuses on **how to use** eden from consuming code.

## Chapters

### Start here

- [Getting started](./getting-started.md) — install, first parse, two modes
- [Data mode vs evaluation mode](./data-mode.md) — the safe pair `parse` / `stringify`
- [Evaluation mode](./evaluation-mode.md) — `evaluate`, scope, policy

### Public API

- [Data mode — `parse` and `parseToAST`](./data-mode.md)
- [Stringify — `stringify` and `stringifyAST`](./stringify.md)
- [Evaluation mode — `evaluate`](./evaluation-mode.md)
- [Security policy](./security-policy.md)
- [JSON interop — `fromJSON` and `toJSON`](./json-interop.md)
- [Tokenize — the low-level lexer entry point](./tokenize.md)
- [Errors — typed hierarchy](./errors.md)

### Language features

- [Strings and templates](./strings-and-templates.md)
- [Numbers and BigInt](./numbers.md)
- [Objects and arrays](./objects-and-arrays.md)
- [Comments](./comments.md)

### Tooling reference

- [AST reference — node shapes for formatters and LSPs](./ast-reference.md)

## Language

- French version: [`doc/fr/`](../fr)
