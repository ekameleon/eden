# `tokenize` — le point d'entrée bas niveau du lexer

`tokenize(source, options?)` retourne le **flux brut de tokens**
d'une source eden. C'est le point d'entrée le plus bas niveau exposé
par eden ; la plupart des consommateurs préféreront
[`parse`](./data-mode.md) ou [`evaluate`](./evaluation-mode.md). Le
flux de tokens est là pour les outils qui ont besoin d'une
information caractère par caractère :

- les coloriseurs de syntaxe (par exemple les grammaires VS Code),
- les modes CodeMirror,
- les linters qui ont besoin de plus de contexte que ce que le parser
  conserve,
- les générateurs de documentation qui affichent les commentaires
  verbatim.

## Utilisation

```js
import { tokenize, TokenType } from "@ekameleon/eden";

const tokens = tokenize(`{ name: "Marc" }`);
// [
//     { type: "PUNCTUATOR",  value: "{",       offset:  0, line: 1, column:  1 },
//     { type: "IDENTIFIER",  value: "name",    offset:  2, line: 1, column:  3 },
//     { type: "PUNCTUATOR",  value: ":",       offset:  6, line: 1, column:  7 },
//     { type: "STRING",      value: "\"Marc\"", offset:  8, line: 1, column:  9 },
//     { type: "PUNCTUATOR",  value: "}",       offset: 15, line: 1, column: 16 },
//     { type: "EOF",         value: "",        offset: 16, line: 1, column: 17 },
// ]
```

Chaque token porte :

| Champ    | Sens                                                          |
|----------|---------------------------------------------------------------|
| `type`   | Une des constantes `TokenType.*` (chaîne discriminante).      |
| `value`  | Le lexème brut tel qu'il apparaît dans la source (avec les délimiteurs pour les chaînes, le suffixe `n` pour les BigInts, etc.). |
| `offset` | Offset zéro-indexé du premier caractère dans la source.       |
| `line`   | Numéro de ligne (un-indexé).                                  |
| `column` | Numéro de colonne (un-indexé).                                |

Le flux se termine toujours par un token `EOF`.

## `TokenType`

```js
import { TokenType } from "@ekameleon/eden";
```

Objet gelé listant chaque type de token produit par le lexer :

```
PUNCTUATOR    KEYWORD       IDENTIFIER
NUMBER        BIGINT        STRING        TEMPLATE
LINE_COMMENT  BLOCK_COMMENT
EOF
```

Les commentaires sont émis comme des tokens à part entière
(`LINE_COMMENT`, `BLOCK_COMMENT`), ce qui permet aux outils qui en
ont besoin de les retrouver ; le parser les ignore en interne.

## Garanties du lexer

- **Aucune entrée/sortie.** Le lexer est pur : la même chaîne donne
  toujours le même flux de tokens.
- **Aucune conscience du scope.** Le lexer ne connaît ni les
  identifiants déclarés par l'utilisateur ni la politique de
  sécurité. Il ne fait respecter que la grammaire **lexicale**.
- **Toutes les erreurs sont `EdenSyntaxError`.** Chaînes non
  terminées, échappements illégaux, commentaires de bloc non
  refermés : tout lève la même classe d'erreur avec un
  `{ line, column, offset }` précis.

## Exemple — compter les commentaires

```js
import { tokenize, TokenType } from "@ekameleon/eden";

const tokens = tokenize(source);
const comments = tokens.filter((t) =>
    t.type === TokenType.LINE_COMMENT || t.type === TokenType.BLOCK_COMMENT
);
console.log(`${comments.length} commentaires`);
```

## Exemple — un coloriseur minimal

```js
function highlight(source) {
    const out = [];
    let cursor = 0;
    for (const token of tokenize(source)) {
        if (token.type === TokenType.EOF) break;
        out.push(source.slice(cursor, token.offset));   // espaces
        out.push(`<span class="tok-${token.type.toLowerCase()}">${escape(token.value)}</span>`);
        cursor = token.offset + token.value.length;
    }
    return out.join("");
}
```

## Références

- [Erreurs](./errors.md)
- [Référence AST](./ast-reference.md)
- Grammaire normative : [`SPEC.md §2`](../../SPEC.md)
- Référence d'architecture : [`ARCHITECTURE.md §3`](../../ARCHITECTURE.md) (forme des tokens)
