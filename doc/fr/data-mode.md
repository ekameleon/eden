# Mode données — `parse` et `parseToAST`

Le mode données est la **surface sûre** d'eden, celle qui reste
compatible avec JSON. Il accepte les littéraux, les tableaux, les
objets, ainsi que les opérateurs unaires `+` et `-` devant une
valeur numérique. Il refuse en revanche tout ce qui demanderait un
contexte d'exécution : références d'identifiants, accès membres,
appels de fonctions, expressions `new`.

C'est le point d'entrée à utiliser pour :

- les fichiers de configuration,
- les payloads d'API,
- partout où tu utiliserais `JSON.parse`.

## `parse(source, options?)`

```js
import { parse } from "@ekameleon/eden";

const value = parse(`{
    name: "Marc",
    active: true,
    tags: ["dev", "maker",],
}`);
// {
//     name: "Marc",
//     active: true,
//     tags: ["dev", "maker"],
// }
```

`parse` retourne la valeur JavaScript décrite par la source. Elle lève
[`EdenSyntaxError`](./errors.md) en cas d'entrée malformée.

Tout document JSON valide est aussi un document eden valide : tu peux
passer un fichier JSON à `parse` sans aucune adaptation.

## `parseToAST(source, options?)`

`parseToAST` retourne **l'AST** correspondant à la même source, au
lieu de la valeur runtime. L'AST conserve la forme syntaxique
d'origine (base numérique, séparateurs de chiffres, style de
guillemets, etc.). C'est le point d'entrée des outils qui doivent
parcourir ou transformer la source — formatters, language servers,
linters.

```js
import { parseToAST } from "@ekameleon/eden";

const ast = parseToAST(`{ name: "Marc", tags: ["dev"] }`);
// Program { mode: "data", body: [ ObjectExpression { ... } ] }
```

Voir [Référence AST](./ast-reference.md) pour la forme des nœuds.

## Options de parsing

Toutes les options ci-dessous sont facultatives. La valeur par défaut
est indiquée en premier.

| Option              | Défaut      | Effet                                                          |
|---------------------|-------------|----------------------------------------------------------------|
| `allowComments`     | `true`      | Accepte les commentaires `//` et `/* */`.                      |
| `allowTrailingCommas` | `true`    | Accepte une virgule finale dans les tableaux et les objets.    |
| `allowSingleQuotes` | `true`      | Accepte les chaînes `'...'`.                                   |
| `allowUnquotedKeys` | `true`      | Accepte les clés sans guillemets si elles ont la forme d'un identifiant. |
| `allowTemplates`    | `true`      | Accepte les templates `` `...` ``.                             |
| `allowBigInt`       | `true`      | Accepte les littéraux BigInt `…n`.                             |
| `allowEmptySource`  | `true`      | `parse("")` retourne `undefined` au lieu de lever une erreur.  |
| `strictMode`        | `true`      | Refuse les clés dupliquées au moment du parse.                 |
| `maxDepth`          | `1024`      | Profondeur d'imbrication maximale avant `EdenSyntaxError`.     |
| `maxStringLength`   | `Infinity`  | Longueur maximale d'une chaîne (utile face à des entrées hostiles). |

### Restreindre le dialecte

Pour limiter l'entrée à du JSON strict :

```js
parse(source, {
    allowComments:       false,
    allowTrailingCommas: false,
    allowSingleQuotes:   false,
    allowUnquotedKeys:   false,
    allowTemplates:      false,
    allowBigInt:         false,
});
```

Utile quand la lib eden tourne côté producteur et qu'on veut
garantir une sortie JSON stricte côté consommateur, ou pour de la
validation défensive.

### Source vide

Par défaut, `parse("")` retourne `undefined`. Pour transformer une
entrée vide en erreur de syntaxe, utilise `allowEmptySource: false` :

```js
parse("", { allowEmptySource: false }); // lève EdenSyntaxError
```

## Références

- [Sérialisation — `stringify` / `stringifyAST`](./stringify.md)
- [Interopérabilité JSON — `fromJSON` / `toJSON`](./json-interop.md)
- [Nombres et BigInt](./numbers.md)
- [Commentaires](./comments.md)
- Grammaire normative : [`SPEC.md §3.1`](../../SPEC.md) (programme en mode données)
