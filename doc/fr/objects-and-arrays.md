# Objets et tableaux

Les littéraux composites sont le pain quotidien d'un document eden.
La syntaxe est celle du littéral objet/tableau JavaScript moderne,
avec quelques aides en plus et quelques restrictions documentées.

## Tableaux

```eden
[]
[1, 2, 3]
[1, 2, 3,]                  // virgule finale autorisée
["mixed", true, null]
[[1, 2], [3]]               // imbrication
```

- Les élisions **ne sont pas** supportées. `[1, , 3]` lève
  `EdenSyntaxError` ; utilise `undefined` ou `null` explicitement.
- Une virgule finale sur le dernier élément est acceptée par défaut.
  Passe `allowTrailingCommas: false` pour l'interdire.

## Objets

```eden
{}
{ name: "Marc" }                            // clé identifiante sans guillemets
{ "key with space": 1 }                     // clé entre guillemets
{ 0: "first" , 1: "second" }                // clé numérique entière
{ name: "Marc", active: true , }            // virgule finale autorisée
```

### Formes de clé

Trois formes de clé sont acceptées :

- `Identifier` — sans guillemets, doit respecter la grammaire
  d'identifiant (lettres, chiffres, `_`, `$`) et ne doit pas être un
  mot réservé.
- `StringLiteral` — entre guillemets (`"..."`, `'...'` ou
  `` `...` ``).
- `NumericLiteral` — n'importe quel littéral numérique reconnu par
  eden.

| Clé source   | Clé runtime (string) | Sortie stringify (par défaut) |
|--------------|---------------------|-------------------------------|
| `name`       | `"name"`            | `name`                        |
| `"name"`     | `"name"`            | `name` (unquotedKeys=true)    |
| `"name"`     | `"name"`            | `"name"` (unquotedKeys=false) |
| `0`          | `"0"`               | `0`                           |
| `0xFF`       | `"255"`             | `0xFF` (côté AST) / `255` (côté valeur) |
| `"01"`       | `"01"`              | `"01"` (entre guillemets — zéro initial) |
| `"1.5"`      | `"1.5"`             | `"1.5"` (entre guillemets — non entier) |
| `"with space"` | `"with space"`    | `"with space"` (entre guillemets) |

Les identifiants qui **ressemblent** à des mots réservés sont
toujours entre guillemets en sortie : `{ null: 1 }` est refusé par
le parser (mode données) ; une valeur runtime avec la clé `"null"`
est sérialisée `{"null": 1}` même si `unquotedKeys: true`.

### Clés dupliquées

Conformément à `SPEC.md §3.5`, la dernière définition gagne — même
sémantique qu'un littéral objet JavaScript. Le parser eden lève
`EdenSyntaxError` sur les clés dupliquées quand `strictMode: true`
(le défaut) ; passe `strictMode: false` pour laisser passer le
doublon avec une résolution last-wins au runtime.

## Propriétés shorthand et computed (mode évaluation uniquement)

Ces deux formes de propriété sont acceptées **uniquement en mode
évaluation**, puisqu'elles ont besoin d'un scope runtime pour avoir
un sens :

```eden
// Shorthand : { name } lit `name` depuis le scope et le stocke
// sous la clé "name".
{ name }

// Clé computed : l'expression entre crochets est évaluée et
// convertie en chaîne au runtime.
{ [keyVar]: 1, [obj.k]: 2 }
```

Le `parse` en mode données refuse les deux. `evaluate` les accepte.

## Virgules finales

Les tableaux comme les objets acceptent une virgule finale :

```eden
[1, 2, 3,]
{ a: 1, b: 2, }
```

`stringify` **n'en émet pas** par défaut. Combine `trailingCommas: true`
avec un `indent` non nul pour en obtenir en sortie :

```js
stringify({ a: 1, b: 2 }, { indent: 2, trailingCommas: true });
// "{
//   a: 1,
//   b: 2,
// }"
```

En forme inline (compacte), l'option est ignorée — une virgule
finale sur une seule ligne fait visuellement du bruit sans rien
apporter aux diffs.

`jsonCompatible: true` supprime toujours les virgules finales,
puisque JSON les interdit.

## Profondeur maximale

Le parser et le serializer plafonnent la profondeur d'imbrication à
`1024` par défaut, pour éviter les débordements de pile sur entrée
hostile. Augmente `maxDepth` quand tu as légitimement besoin de
structures plus profondes, ou mets-le à `Infinity` pour désactiver
la garde.

```js
parse(source, { maxDepth: Infinity });
stringify(value, { maxDepth: 64 });
```

## Détection des cycles (stringify)

`stringify` détecte les structures runtime circulaires et lève
`EdenTypeError("Converting circular structure to eden.")` au lieu
de faire exploser la pile. Partager un sous-objet entre frères
**n'est pas** un cycle et fonctionne sans souci :

```js
const shared = { x: 1 };
stringify({ a: shared, b: shared }); // OK — "{a:{x:1},b:{x:1}}"

const cycle = {};
cycle.self = cycle;
stringify(cycle); // EdenTypeError
```

## Références

- [Mode données — `parse` / `parseToAST`](./data-mode.md)
- [Sérialisation — `stringify` / `stringifyAST`](./stringify.md)
- [Mode évaluation — `evaluate`](./evaluation-mode.md)
- Grammaire normative : [`SPEC.md §3.4`](../../SPEC.md) (tableaux),
  [`SPEC.md §3.5`](../../SPEC.md) (objets)
