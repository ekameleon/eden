# CLAUDE.md

Instructions for Claude Code working on the **eden** project.
Read this file at the start of every session, then read `SPEC.md` and
`ARCHITECTURE.md` before touching any code.

---

## 1. Language & syntax

- **JavaScript only.** ES2022 target. No TypeScript anywhere in `src/`.
- **JSDoc is mandatory** on every exported symbol (functions, classes,
  constants) and on every non-trivial internal function.
- JSDoc drives the generated `.d.ts` file — write it as if consumers will read it.
- **ES modules only** in source (`import` / `export`). No `require()`, no CommonJS.
- **Classes with `#private` fields** where encapsulation matters.
- Prefer `const` and pure functions over mutable state.

## 2. Code style

- **Indentation: 4 spaces.** Never tabs.
- **Allman braces** — opening brace on its own line, matching the original eden codebase.
- **No semicolons omitted.** Always terminate statements explicitly.
- **Double quotes** for strings in source code (single quotes reserved
  for cases where doubles would require escaping).
- **No clever one-liners.** Readability wins.
- **No abbreviations** in public names (`parseSource`, not `parseSrc`).

Example of the expected style:

```js
/**
 * Tokenizes an eden source string.
 *
 * @param   {string}          source - The source text to tokenize.
 * @param   {LexerOptions}   [options] - Optional lexer configuration.
 * @returns {Token[]}         The full token stream, including EOF.
 * @throws  {EdenSyntaxError} If an illegal character is encountered.
 */
export function tokenize( source, options )
{
    const lexer = new Lexer( source, options );
    return lexer.run();
}
```

## 3. Architecture rules

These are contracts, not suggestions.

- **Lexer** is a pure function `string → Token[]`. No global state, no I/O,
  no scope awareness, no security checks.
- **Parser** consumes tokens and produces an AST. AST node shapes are
  documented in `ARCHITECTURE.md` — do not invent new shapes without
  updating that file first.
- **Serializer** consumes an AST or a value and produces a string.
  It never evaluates anything.
- **Evaluator** is the **only** layer allowed to touch scope, security
  policy, call functions, or instantiate constructors.
- `parse()` and `stringify()` **never** evaluate. If a feature requires
  a scope, it belongs in `evaluate()`.
- **No global mutable config.** All options are passed per-call through
  the `options` parameter. The original `buRRRn.eden.config` pattern is
  explicitly forbidden.

## 4. Dependencies

- **Runtime dependencies: zero.** This is a standalone library.
- **Dev dependencies:** only `typescript` for `.d.ts` generation. Nothing else.
- If you think you need a new dependency, **stop and ask.** The answer will
  almost always be no.

## 5. Testing

- Every module has a matching test file in `test/`.
- Use `bun test`. No other test runner.
- **Conformance fixtures** in `test/fixtures/` are the source of truth for
  `parse` / `stringify` behavior. They are shared with the future PHP port —
  do not delete or reshape them casually.
- When adding a grammar feature, add fixtures covering it.
- Run `bun test` before claiming a task is complete.

## 6. Build & distribution

- Build is driven by **Bun only**. Never add Babel, webpack, rollup, or esbuild.
- `bun run build` must produce: ESM, CJS, IIFE, IIFE-minified, and `.d.ts`.
- Source code must remain usable as-is in modern browsers and Node 18+ without
  transpilation.

## 7. What NOT to do

- Do not introduce TypeScript syntax in `src/`.
- Do not add a new build tool.
- Do not silently change the grammar. If `SPEC.md` does not cover a case,
  stop and ask before deciding.
- Do not remove JSDoc blocks, ever.
- Do not introduce runtime dependencies.
- Do not create a global mutable config object.
- Do not mix parsing and evaluation in the same module.

## 8. Commit style

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`,
  `chore:`, `build:`, `ci:`, `bench:`.
- One logical change per commit.
- Commit messages in English.
- Always reference the issue number when applicable: `feat(lexer): tokenize
  template literals (#4)`.

## 9. Session workflow

When given a task:

1. Read `CLAUDE.md`, `SPEC.md`, `ARCHITECTURE.md`, and the relevant issue.
2. Propose a plan before coding. Wait for confirmation.
3. Implement.
4. Run `bun test` and `bun run build`.
5. Commit on a feature branch following conventional commits.
6. Summarize what was done.

## 10. When in doubt

Ask. Marc prefers a short clarifying question over a wrong assumption that
has to be reverted. The grammar and API surface are settled in `SPEC.md` and
`ARCHITECTURE.md`; everything else is discussable.