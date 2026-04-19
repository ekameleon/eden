# Getting started

> **Status.** The library is under active development. This page
> documents how to install eden and what the public API will look like
> once it is wired. Calls to `parse`, `stringify` and `evaluate` will
> start working when the corresponding modules land (see the roadmap
> in the root [`README.md`](../../README.md)).

## Installation

```bash
npm install @ekameleon/eden
# or
bun add @ekameleon/eden
```

### From a CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@ekameleon/eden"></script>
<script>
    const value = eden.parse(`{ name: "Marc", tags: ["dev", "maker",] }`);
    console.log(value);
</script>
```

## Your first parse

```js
import { parse } from "@ekameleon/eden";

const source = `{
    // unquoted keys, trailing commas, comments
    name: "Marc",
    tags: ["dev", "maker",],
}`;

const value = parse(source);
// {
//     name: "Marc",
//     tags: ["dev", "maker"]
// }
```

Every valid JSON document is also a valid eden document, with the same
semantics. That means you can point `parse` at any JSON file today and
migrate the syntax to the richer eden dialect whenever you want.

## Two modes, one library

- **Data mode** — `parse` / `stringify`. Safe by default: no identifier
  resolution, no function calls, no `new` expressions. This is the
  JSON-compatible surface.
- **Evaluation mode** — `evaluate`. Runs an eden program against an
  explicit `scope` and a `policy`. Every access is checked against the
  policy. Use this when your configuration legitimately needs things
  like `new Date("2024-01-15")`.

See [`SPEC.md §1`](../../SPEC.md) for the normative definition of the
two modes.

## Next steps

- Read [`SPEC.md`](../../SPEC.md) for the full grammar.
- Read [`ARCHITECTURE.md`](../../ARCHITECTURE.md) for the public API
  surface and the option reference.
- Browse [`test/fixtures/parse/`](../../test/fixtures/parse) for small,
  executable examples of supported syntax.
