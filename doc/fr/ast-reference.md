# Référence AST

eden produit un AST **dans l'esprit ESTree** : les outils écrits
pour ESTree s'adaptent à eden avec peu de changements. Les formes
ci-dessous sont normatives pour l'implémentation JavaScript ; le
futur portage PHP livrera les mêmes formes sous forme de tableaux
sérialisés.

Cette page liste chaque type de nœud produit par le parser. Sers-t'en
comme référence quand tu écris un formatter, un language server, une
transformation custom, ou n'importe quel outil qui parcourt l'arbre.

## Base commune

Chaque nœud porte :

```js
{
    type: string,     // discriminant, par exemple "Literal"
    offset: number,   // offset zéro-indexé dans la source
    line:   number,   // numéro de ligne (un-indexé)
    column: number,   // numéro de colonne (un-indexé)
}
```

Les champs de localisation sont remplis par le parser. Ils ne sont
pas obligatoires si tu forges un nœud manuellement pour
`stringifyAST` / `evalAST`.

## L'énumération `NodeType`

```js
import { NodeType } from "@ekameleon/eden";
```

Objet gelé qui expose les chaînes canoniques :

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

Le nœud racine.

```js
{
    type: "Program",
    mode: "data" | "eval",
    body: Node[],
}
```

En mode `data`, `body` contient **exactement un** nœud. En mode
`eval`, `body` contient zéro ou plusieurs statements.

## `Literal`

```js
{
    type:  "Literal",
    value: null | undefined | boolean | number | bigint | string,
    raw:   string,    // lexème d'origine tel qu'écrit dans la source
    kind:  "null" | "undefined" | "boolean" | "number"
         | "bigint" | "string" | "template",
}
```

`kind` distingue les formes sources qui partagent une même valeur JS
(`"string"` vs `"template"` pour une chaîne identique ;
`"number"` pour `0xFF`, `255`, `1_000`, `1e3`, etc.). `raw`
préserve le lexème d'origine, ce qui rend l'aller-retour AST
sans perte via `stringifyAST`.

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
    computed: boolean,        // true pour obj["x"], false pour obj.x
}
```

Quand `computed` est `true`, `property` est un `Literal` de kind
`"string"` ou `"number"` (restriction de grammaire de SPEC §3.3).

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
    key:       Identifier | Literal | Node,  // Node quand computed
    value:     Node,
    shorthand: boolean,
    computed:  boolean,
}
```

En mode données, `shorthand` et `computed` sont toujours `false`. En
mode évaluation, les deux peuvent être `true`.

## `UnaryExpression`

```js
{
    type:     "UnaryExpression",
    operator: "+" | "-",
    argument: Node,
}
```

En mode données, l'argument est restreint à un Literal numérique
(règle `UnaryValue` de SPEC §3.1). En mode évaluation, ça peut être
n'importe quelle expression.

## `CallExpression`

```js
{
    type:      "CallExpression",
    callee:    Node,           // Identifier | MemberExpression
    arguments: Node[],
}
```

Mode évaluation uniquement.

## `NewExpression`

```js
{
    type:      "NewExpression",
    callee:    Node,           // Identifier | MemberExpression
    arguments: Node[],
}
```

Le parser émet la même forme pour `new Foo` et pour `new Foo()` :
`arguments` est un tableau vide dans les deux cas. `stringifyAST`
émet la forme sans parenthèses `new Foo`, qui est l'équivalent le
plus court.

Mode évaluation uniquement.

## `AssignmentStatement`

```js
{
    type:   "AssignmentStatement",
    target: Identifier | MemberExpression,
    value:  Node,
}
```

Mode évaluation uniquement.

## Travailler avec l'AST

### Parcourir

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
        console.log("ident :", node.name);
    }
});
```

Une vraie implémentation voudra sans doute sauter le champ `value`
d'un `Literal` (qui est un primitif JS, pas un nœud) et d'autres
valeurs terminales — le test `typeof child.type === "string"` ci-dessus
joue ce rôle.

### Construire

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

`stringifyAST` tolère l'absence de `offset` / `line` / `column` sur
les nœuds forgés — ces champs ne servent qu'aux messages d'erreur.

### Autres discriminants

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

## Références

- [Mode données — `parseToAST`](./data-mode.md)
- [Sérialisation — `stringifyAST`](./stringify.md)
- [Tokenize](./tokenize.md)
- Référence d'architecture : [`ARCHITECTURE.md §4`](../../ARCHITECTURE.md)
