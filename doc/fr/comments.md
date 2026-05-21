# Commentaires

eden accepte les commentaires de ligne et de bloc partout où des
espaces sont permis. Ils sont retirés par le parser et n'ont aucun
effet sur la valeur parsée.

## Commentaires de ligne

```eden
{
    // les clés sans guillemets rendent les fichiers de config plus lisibles
    name: "Marc",
    // un commentaire de ligne s'étend jusqu'à la fin de la ligne
}
```

Un commentaire de ligne commence à `//` et se termine au prochain
terminateur de ligne (`\n`, `\r`, ` `, ` `) ou en fin d'entrée.

## Commentaires de bloc

```eden
{
    name: "Marc",
    /*
     * Les commentaires multi-lignes fonctionnent aussi.
     * Pas d'imbrication — voir plus bas.
     */
    active: true,
}
```

Un commentaire de bloc commence à `/*` et se termine au prochain
`*/`. Les commentaires de bloc **ne s'imbriquent pas** : le premier
`*/` rencontré dans le corps ferme le commentaire, peu importe ce
qui précédait.

```eden
/* outer /* inner */ tail   // erreur de syntaxe : `tail */` n'est plus un commentaire
```

Un commentaire de bloc non terminé (qui atteint la fin de l'entrée
sans `*/` de fermeture) lève `EdenSyntaxError`.

## À l'intérieur d'une chaîne

Un `//` ou `/*` dans une chaîne littérale, c'est juste du texte — le
lexer ne reconnaît les commentaires qu'entre les tokens.

```eden
{
    sql: "SELECT // from users",        // le // fait partie de la chaîne
    note: "block start /* keeps going", // pareil
}
```

## Désactiver les commentaires

Les commentaires peuvent être complètement désactivés avec
`allowComments: false`. N'importe quel `//` ou `/*` lèvera alors
`EdenSyntaxError`. Pratique pour garantir une entrée 100 % JSON :

```js
parse(source, { allowComments: false });
```

## Les commentaires dans le flux de tokens

`tokenize` préserve les commentaires comme types de tokens à part
entière :

```
TokenType.LINE_COMMENT
TokenType.BLOCK_COMMENT
```

Le parser les saute, mais ils restent disponibles pour les outils
qui en ont besoin — générateurs de documentation, formatters qui
veulent conserver les commentaires en place, moteurs de coloration
syntaxique dans les IDE. Voir [tokenize](./tokenize.md).

## Et JSON ?

JSON ne permet pas les commentaires. Si tu donnes une source eden
avec des commentaires à `JSON.parse`, ça échoue. `eden.parse`, lui,
les accepte.

Si tu as besoin d'une version JSON propre d'une source eden
commentée :

```js
import { parse, toJSON } from "@ekameleon/eden";

const value    = parse(commentedSource);
const jsonSafe = toJSON(value);   // commentaires retirés, JSON strict
```

## Références

- [Mode données — `parse` / `parseToAST`](./data-mode.md)
- [Tokenize](./tokenize.md)
- Grammaire normative : [`SPEC.md §2.4`](../../SPEC.md) (commentaires)
