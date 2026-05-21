# Nombres et BigInt

eden hérite du modèle numérique d'ECMAScript : tout littéral
numérique sans suffixe `n` est parsé en `Number` IEEE-754 double
précision ; les littéraux avec le suffixe `n` deviennent des
`BigInt`. Trois bases numériques et les séparateurs de chiffres sont
acceptés — la syntaxe est alignée sur le JavaScript moderne.

## Décimal

```eden
0
42
1.5
-1.5
1e10
1.5e-3
1_000_000          // séparateurs underscore entre chiffres
```

Les séparateurs numériques sont purement cosmétiques — ils n'ont
aucun effet sur la valeur parsée (`1_000_000 === 1000000`). Ils sont
autorisés **entre** des chiffres uniquement ; un séparateur en
début, en fin ou consécutif lève `EdenSyntaxError`.

Un littéral peut avoir une partie fractionnaire **et** un exposant,
dans n'importe quelle combinaison.

## Hexadécimal, octal, binaire

```eden
0xFF              // hex   → 255
0o17              // octal → 15  (préfixe moderne uniquement ; 017 est refusé)
0b1010            // bin   → 10
```

Les octaux ECMAScript historiques (`0777` sans le préfixe explicite
`0o`) **ne sont pas** supportés — utilise la forme moderne.

Les préfixes `0x`, `0o`, `0b` acceptent la même règle de
séparateurs de chiffres que le décimal : `0xFF_FF`, `0b1010_0101`.

## BigInt

```eden
0n
1n
9007199254740993n          // dépasse Number.MAX_SAFE_INTEGER
1_000n                     // séparateurs autorisés
0xFFn                      // bases autorisées
```

Les BigInts ne peuvent pas avoir de partie fractionnaire ni
d'exposant — même règle qu'en ECMAScript. La règle décimale/exposant
et le suffixe `n` sont tous deux vérifiés par le lexer.

### BigInt en mode JSON-compatible

`JSON.parse` ne sait pas lire les littéraux BigInt et `JSON.stringify`
refuse de les sérialiser. eden fait pareil :

- `stringify(1n, { jsonCompatible: true })` → lève `EdenTypeError`.
- `fromJSON("1n")` → lève `EdenSyntaxError` (le `JSON.parse` natif
  refuse).
- `toJSON({ big: 1n })` → lève `EdenTypeError`.

Utilise les BigInts en eden pur, pas en interop JSON.

## Valeurs spéciales

`NaN` et `Infinity` sont des mots-clés en eden. Ils évaluent vers les
constantes JavaScript `Number.NaN` et `Number.POSITIVE_INFINITY`
respectivement.

```eden
NaN              // Number.NaN
Infinity         // Number.POSITIVE_INFINITY
-Infinity        // Number.NEGATIVE_INFINITY (moins unaire)
-NaN             // Number.NaN (le moins unaire sur NaN reste NaN)
```

### En mode `jsonCompatible`

JSON n'a pas de syntaxe pour `NaN` ou `±Infinity`. `stringify` les
substitue par `null` quand `jsonCompatible: true` :

```js
stringify({ x: NaN, y: Infinity }, { jsonCompatible: true });
// '{"x":null,"y":null}'
```

## Unaire `+/-` sur les littéraux numériques

```eden
-1
+1
-1n              // BigInt négatif
-Infinity
-NaN
```

En mode données, l'opérateur unaire ne peut être devant qu'un
littéral numérique (Number, BigInt, `Infinity`, `NaN`) — c'est la
règle `UnaryValue` de SPEC §3.1.

En mode évaluation, l'opérateur unaire accepte n'importe quelle
expression qui résout vers une valeur numérique (`-foo` lit `foo`
depuis le scope et le négatif).

### `+` sur un `BigInt` lève un `TypeError`

```js
evaluate("+1n", {});
// TypeError (natif) : "Cannot convert a BigInt value to a number"
```

C'est le comportement hôte de JavaScript — `+1n` est aussi illégal
en JS. La négation `-1n` fonctionne sans problème.

## Fidélité de l'aller-retour via l'AST

L'AST préserve le **lexème brut** de chaque littéral numérique. Un
aller-retour parse / stringify via `parseToAST` + `stringifyAST`
conserve `0xFF` en `0xFF`, `1_000n` en `1_000n`, `1.5e2` en `1.5e2`.

```js
import { parseToAST, stringifyAST } from "@ekameleon/eden";

stringifyAST(parseToAST("0xFF")); // "0xFF" — préservé
stringify(255);                   // "255"   — recalculé depuis la valeur
```

`jsonCompatible: true` recalcule toujours depuis la valeur, puisque
le dialecte cible (JSON) n'accepte ni les bases hex / oct / bin ni
les séparateurs.

## Références

- [Mode données — `parse` / `parseToAST`](./data-mode.md)
- [Sérialisation — `stringify` / `stringifyAST`](./stringify.md)
- [Interopérabilité JSON — `fromJSON` / `toJSON`](./json-interop.md)
- Grammaire normative : [`SPEC.md §2.8`](../../SPEC.md) (littéraux numériques)
