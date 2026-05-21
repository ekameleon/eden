# Sérialisation — `stringify` et `stringifyAST`

eden fournit deux points d'entrée complémentaires pour aller **d'une
valeur vers une chaîne** :

- `stringify(value, options?)` — prend une valeur JavaScript, retourne
  une source eden (ou JSON). Le miroir de `parse`.
- `stringifyAST(ast, options?)` — prend un nœud AST (généralement
  produit par `parseToAST`), retourne une source. Conserve les
  lexèmes d'origine quand c'est possible : un aller-retour
  parse / stringify reste fidèle aux bases numériques, séparateurs,
  styles de guillemets, etc.

## `stringify(value, options?)`

```js
import { stringify } from "@ekameleon/eden";

stringify({ name: "Marc", tags: ["dev", "maker"] });
// '{name:"Marc",tags:["dev","maker"]}'

stringify({ name: "Marc" }, { indent: 2 });
// '{\n  name: "Marc"\n}'
```

## `stringifyAST(ast, options?)`

`stringifyAST` parcourt un AST plutôt qu'une valeur. C'est le point
d'entrée des formatters et de tout outil qui a produit ou modifié un
AST et veut en récupérer une source fidèle.

```js
import { parseToAST, stringifyAST } from "@ekameleon/eden";

const ast  = parseToAST("{ count: 0xFF, big: 1_000n }");
const back = stringifyAST(ast);
// "{ count: 0xFF, big: 1_000n }"  — lexèmes d'origine préservés
```

Le même AST traversé via `stringify(parse(...))` ferait l'aller-retour
sur les valeurs, mais normaliserait `0xFF` en `255` et `1_000n` en
`1000n`. Utilise `stringifyAST` dès que la fidélité au texte source
compte.

## Options de sérialisation

| Option            | Défaut     | Effet                                                       |
|-------------------|------------|-------------------------------------------------------------|
| `indent`          | `0`        | Nombre d'espaces, ou chaîne d'indentation explicite. `0` ou `""` → forme inline compacte. Borné à 10 espaces ou 10 caractères. |
| `quotes`          | `"double"` | Style de guillemets préféré pour les chaînes. `"double"` ou `"single"`. |
| `trailingCommas`  | `false`    | Ajoute une virgule finale après la dernière entrée des tableaux et objets indentés. |
| `unquotedKeys`    | `true`     | Émet les clés sans guillemets quand elles ont la forme d'un identifiant. Les clés entières non négatives sans zéro initial sont aussi sans guillemets. |
| `sortKeys`        | `false`    | Trie les clés des objets par ordre lexicographique.         |
| `jsonCompatible`  | `false`    | Force une sortie JSON stricte : clés entre guillemets, pas de templates, pas de BigInt, pas de `undefined`, `NaN`/`±Infinity` deviennent `null`, pas de virgules finales. |
| `replacer`        | `null`     | Fonction `(key, value) => replacement` appelée à chaque entrée. Même sémantique que `JSON.stringify`. |
| `maxDepth`        | `1024`     | Profondeur d'imbrication maximale avant `EdenTypeError`. Symétrique de `ParseOptions.maxDepth`. |

### Indentation

```js
stringify([1, 2, 3]);                    // "[1,2,3]"
stringify([1, 2, 3], { indent: 2 });
// "[
//    1,
//    2,
//    3
//  ]"
stringify([1, 2, 3], { indent: "\t" });  // indenté avec tabulations
```

`indent` accepte un nombre (en espaces) ou une chaîne (utilisée comme
unité d'indentation). Les valeurs supérieures à 10 sont ramenées à 10
espaces ; les chaînes plus longues que 10 caractères sont tronquées à
10. Comportement aligné sur `JSON.stringify`.

### Style de guillemets

```js
stringify("Hello", { quotes: "single" }); // "'Hello'"
```

`quotes` contrôle l'émission de `"..."` ou de `'...'`. Le guillemet
n'est échappé que quand il entre en conflit avec le style choisi.

### Tri des clés

```js
stringify({ b: 1, a: 2 }, { sortKeys: true });
// "{a:2,b:1}"
```

Pratique pour une sortie canonique : clés de cache, hachage, diff
déterministe.

### Mode compatible JSON

```js
stringify({ a: 1, b: undefined, c: NaN }, { jsonCompatible: true });
// '{"a":1,"c":null}'
```

`jsonCompatible: true` produit du JSON strict. Les `BigInt` lèvent
`EdenTypeError` (même comportement que `JSON.stringify`). `undefined`
dans un tableau devient `null` ; `undefined` dans un objet est
supprimé.

Pour une enveloppe plus découvrable, voir
[`fromJSON` / `toJSON`](./json-interop.md).

### Replacer

```js
const result = stringify(
    { keep: 1, drop: 2, age: 30 },
    { replacer: (key, value) => key === "drop" ? undefined : value }
);
// '{keep:1,age:30}'
```

Même sémantique que `JSON.stringify` :

- Premier appel avec `key === ""` sur un wrapper synthétique, ce qui
  permet de remplacer ou de supprimer la valeur racine.
- Dans un objet : retourner `undefined` supprime l'entrée.
- Dans un tableau : retourner `undefined` met `null` à la place.

Le replacer n'est consulté que côté **valeur**. `stringifyAST`
l'ignore — ce chemin est structurel par nature.

### Détection des cycles

```js
const obj = {};
obj.self = obj;
stringify(obj); // EdenTypeError : "Converting circular structure to eden."
```

Les références circulaires (sur soi-même, ou mutuelles) lèvent
`EdenTypeError` au lieu de faire exploser la pile. Partager un
sous-objet entre frères (utilisé deux fois mais pas en ancêtre) **ne
constitue pas** un cycle et fonctionne normalement.

## Aller-retour

```js
import { parse, stringify } from "@ekameleon/eden";

const original = '{ name: "Marc", tags: ["dev"] }';
const value    = parse(original);
const back     = stringify(value, { indent: 4 });
const reparsed = parse(back);
// value et reparsed sont deeply-equal
```

L'aller-retour au niveau valeur est toujours sans perte (modulo les
substitutions documentées en `jsonCompatible`). Pour la fidélité au
lexème (bases numériques, séparateurs, styles de guillemets exacts),
utilise plutôt l'aller-retour AST — `parseToAST` puis `stringifyAST`.

## Références

- [Mode données — `parse` / `parseToAST`](./data-mode.md)
- [Interopérabilité JSON — `fromJSON` / `toJSON`](./json-interop.md)
- [Nombres et BigInt](./numbers.md)
- [Erreurs](./errors.md)
- Référence d'architecture : [`ARCHITECTURE.md §6.2`](../../ARCHITECTURE.md) (StringifyOptions)
