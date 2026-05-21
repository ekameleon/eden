# AST reference

eden produces an **ESTree-flavoured** AST: tools written for ESTree
can be adapted to eden with minimal changes. The shapes below are
normative for the JavaScript implementation; the future PHP port
ships the same shapes serialized as arrays.

This page lists every node type the parser produces. Use it as a
reference when writing formatters, language servers, custom
transformations, or anything else that walks the tree.

## Common base

Every node carries:

```js
{
    type: string,     // discriminator, e.g. "Literal"
    offset: number,   // zero-based source offset
    line:   number,   // one-based line number
    column: number,   // one-based column number
}
```

Location fields are populated by the parser. They are not required
when you forge a node manually for `stringifyAST` / `evalAST`.

## `NodeType` enum

```js
import { NodeType } from "@ekameleon/eden";
```

Frozen object exposing the canonical type strings:

```
PROGRAM              "Program"
LITERAL              "Literal"
IDENTIFIER           "Identifier"
MEMBER_EXPRESSION    "MemberExpression"
ARRAY_EXPRESSION     "ArrayExpression"
OBJECT_EXPRESSION    "ObjectExpression"
PROPERTY             "Property"
UNARY_EXPRESSION     "UnaryExpression"
CALL_EXPRESSION      "CallExpression"
NEW_EXPRESSION       "NewExpression"
ASSIGNMENT_STATEMENT "AssignmentStatement"
```

## `Program`

The root node.

```js
{
    type: "Program",
    mode: "data" | "eval",
    body: Node[],
}
```

In `data` mode, `body` contains **exactly one** node. In `eval` mode,
`body` contains zero or more statements.

## `Literal`

```js
{
    type:  "Literal",
    value: null | undefined | boolean | number | bigint | string,
    raw:   string,    // original lexeme as written in the source
    kind:  "null" | "undefined" | "boolean" | "number"
         | "bigint" | "string" | "template",
}
```

`kind` discriminates source forms that share a JS value
(`"string"` vs `"template"` for the same string; `"number"` for
`0xFF`, `255`, `1_000`, `1e3`, etc.). `raw` preserves the original
lexeme so the AST round-trips losslessly through `stringifyAST`.

## `Identifier`

```js
{ type: "Identifier", name: string }
```

## `MemberExpression`

```js
{
    type:     "MemberExpression",
    object:   Node,
    property: Identifier | Literal,
    computed: boolean,        // true for obj["x"], false for obj.x
}
```

When `computed` is `true`, `property` is a `Literal` of kind
`"string"` or `"number"` (per SPEC §3.3 grammar restriction).

## `ArrayExpression`

```js
{ type: "ArrayExpression", elements: Node[] }
```

## `ObjectExpression`

```js
{ type: "ObjectExpression", properties: Property[] }
```

## `Property`

```js
{
    type:      "Property",
    key:       Identifier | Literal | Node,  // Node when computed
    value:     Node,
    shorthand: boolean,
    computed:  boolean,
}
```

In data mode, `shorthand` and `computed` are always `false`. In eval
mode, both can be `true`.

## `UnaryExpression`

```js
{
    type:     "UnaryExpression",
    operator: "+" | "-",
    argument: Node,
}
```

In data mode the argument is restricted to a numeric Literal (the
`UnaryValue` rule of SPEC §3.1). In eval mode it can be any expression.

## `CallExpression`

```js
{
    type:      "CallExpression",
    callee:    Node,           // Identifier | MemberExpression
    arguments: Node[],
}
```

Eval mode only.

## `NewExpression`

```js
{
    type:      "NewExpression",
    callee:    Node,           // Identifier | MemberExpression
    arguments: Node[],
}
```

The parser emits the same shape for `new Foo` and `new Foo()`:
`arguments` is an empty array in both cases. `stringifyAST` emits the
parenless `new Foo` form, which is the shortest equivalent.

Eval mode only.

## `AssignmentStatement`

```js
{
    type:   "AssignmentStatement",
    target: Identifier | MemberExpression,
    value:  Node,
}
```

Eval mode only.

## Working with the AST

### Walk

```js
function walk(node, visit) {
    visit(node);
    for (const key of Object.keys(node)) {
        const child = node[key];
        if (Array.isArray(child)) {
            for (const item of child) {
                if (item && typeof item.type === "string") walk(item, visit);
            }
        } else if (child && typeof child.type === "string") {
            walk(child, visit);
        }
    }
}

walk(parseToAST(source), (node) => {
    if (node.type === "Identifier") {
        console.log("ident:", node.name);
    }
});
```

A real implementation will likely want to skip the `value` field of
`Literal` (a JS primitive, not a node) and other terminal values —
the helper above checks `typeof child.type === "string"` for that.

### Build

```js
import { NodeType, LiteralKind, stringifyAST } from "@ekameleon/eden";

const ast = {
    type: NodeType.OBJECT_EXPRESSION,
    properties: [
        {
            type: "Property",
            key:   { type: NodeType.IDENTIFIER, name: "answer" },
            value: { type: NodeType.LITERAL, kind: LiteralKind.NUMBER, value: 42 },
            shorthand: false,
            computed:  false,
        },
    ],
};

stringifyAST(ast); // "{answer:42}"
```

`stringifyAST` tolerates missing `offset` / `line` / `column` on
forged nodes — they are read only by error-message machinery.

### Other discriminators

```js
import { LiteralKind, ProgramMode } from "@ekameleon/eden";

LiteralKind.NULL      // "null"
LiteralKind.UNDEFINED // "undefined"
LiteralKind.BOOLEAN   // "boolean"
LiteralKind.NUMBER    // "number"
LiteralKind.BIGINT    // "bigint"
LiteralKind.STRING    // "string"
LiteralKind.TEMPLATE  // "template"

ProgramMode.DATA      // "data"
ProgramMode.EVAL      // "eval"
```

## Related

- [Data mode — `parseToAST`](./data-mode.md)
- [Stringify — `stringifyAST`](./stringify.md)
- [Tokenize](./tokenize.md)
- Architecture reference: [`ARCHITECTURE.md §4`](../../ARCHITECTURE.md)
