# Interopérabilité JSON — `fromJSON` et `toJSON`

eden fournit deux helpers fins pour aller et venir entre JSON et eden
sans avoir à descendre dans les API bas niveau.

## `toJSON(value, options?)`

```js
import { toJSON } from "@ekameleon/eden";

toJSON({ name: "Marc", tags: ["dev"] });
// '{"name":"Marc","tags":["dev"]}'

toJSON({ name: "Marc" }, { indent: 2 });
// '{\n  "name": "Marc"\n}'
```

Fonctionnellement équivalent à :

```js
stringify(value, { ...options, jsonCompatible: true });
```

`jsonCompatible: true` est forcé ; les autres options de
sérialisation (`indent`, `sortKeys`, `replacer`, `maxDepth`, …) sont
relayées telles quelles. Les options qui n'ont aucun effet en mode
JSON-compatible (`unquotedKeys`, `quotes`, `trailingCommas`) sont
silencieusement neutralisées.

Les valeurs `BigInt` lèvent `EdenTypeError`, comme le fait
`JSON.stringify`.

## `fromJSON(jsonSource, options?)`

```js
import { fromJSON } from "@ekameleon/eden";

fromJSON('{"name":"Marc","tags":["dev"]}');
// '{name:"Marc",tags:["dev"]}'

fromJSON('{"a":1}', { indent: 2, quotes: "single" });
// "{\n  a: 1\n}"
```

L'entrée est parsée avec le `JSON.parse` natif (strict, rapide,
éprouvé), puis ré-émise via le serializer eden avec les options
fournies. Par défaut, la sortie utilise les idiomes eden : clés
identifiantes sans guillemets, chaînes en guillemets doubles, pas de
virgules finales.

Un JSON malformé en entrée lève `EdenSyntaxError`, en conservant le
`SyntaxError` natif d'origine sur la chaîne `cause` — comme ça
l'appelant peut attraper une seule classe d'erreur :

```js
try {
    fromJSON("{ this is not json }");
} catch (error) {
    error instanceof EdenSyntaxError; // true
    error.cause instanceof SyntaxError; // true (natif)
}
```

## Substitutions

Les deux fonctions respectent les règles SPEC §6.1 du côté JSON :

| Entrée                  | Sortie (`toJSON`, côté JSON) |
|-------------------------|------------------------------|
| `undefined` dans un objet  | supprimé                  |
| `undefined` dans un tableau| `null`                    |
| `undefined` au top-level   | `"null"`                  |
| `NaN`, `±Infinity`         | `null`                    |
| `BigInt`                   | lève `EdenTypeError`      |
| Clés d'objet               | toujours en guillemets doubles |
| Templates                  | dégradés en chaînes JSON  |
| Virgules finales           | supprimées                |

## Aller-retour

```js
import { parse, fromJSON, toJSON } from "@ekameleon/eden";

const jsonSrc = '{"name":"Marc","tags":["dev"]}';
const value   = parse(fromJSON(jsonSrc));
JSON.parse(toJSON(value)).deepEqual(value); // true
```

`JSON.parse(toJSON(value))` réussit toujours et retourne une valeur
deeply-equal à l'originale (modulo les substitutions documentées).
`parse(fromJSON(jsonSrc))` est structurellement équivalent à
`JSON.parse(jsonSrc)`.

## Quand utiliser quoi

| Besoin | Outil |
|---|---|
| Prendre une valeur JS, sortir de l'eden | `stringify` |
| Prendre une valeur JS, sortir du JSON strict | `toJSON` (ou `stringify(..., { jsonCompatible: true })`) |
| Reformater un fichier JSON en idiomes eden | `fromJSON` |
| Parser du JSON | `JSON.parse` (le `parse` d'eden accepte aussi le JSON, mais `JSON.parse` est plus rapide sur du JSON pur) |

## Références

- [Sérialisation — `stringify` / `stringifyAST`](./stringify.md)
- [Mode données — `parse` / `parseToAST`](./data-mode.md)
- Règles de la spec : [`SPEC.md §6`](../../SPEC.md)
