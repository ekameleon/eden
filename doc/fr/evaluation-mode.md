# Mode évaluation — `evaluate`

Le mode évaluation est la partie **opt-in** d'eden, celle qui peut
exécuter du code. Il fait tourner un programme eden contre un
`scope` explicite et une `policy` (politique de sécurité), avec un
support complet pour la résolution d'identifiants, l'accès membre,
les appels de fonctions, les expressions `new` et les affectations.

À utiliser quand ta configuration a légitimement besoin de choses qui
ne s'expriment pas comme de simples données : typiquement
`new Date(...)` ou `Array.from(...)`.

Pour tout le reste, utilise plutôt le [mode données](./data-mode.md).
Il est strictement plus sûr : pas de scope, pas d'appels, pas de
`new`.

## `evaluate(source, options?)`

```js
import { evaluate } from "@ekameleon/eden";

const result = evaluate(
    `user = { name: "Marc", joined: new Date("2024-01-15") }
     user.active = true
     user`,
    {
        scope:  {},
        policy: {
            allowConstructor: true,
            authorized:       ["Date"],
        },
    },
);
// result === scope.user === { name, joined: Date, active: true }
```

### Le résultat d'un programme eval

Conformément à `SPEC.md §3.2`, le programme retourne la valeur de la
**dernière expression qui n'est pas une affectation**. Si le programme
ne contient que des affectations, le résultat est `undefined`. Les
affectations elles-mêmes ont quand même lieu sur le scope — seule la
valeur de retour est masquée.

```js
evaluate("a = 1; b = 2", { scope: {} });        // undefined
evaluate("a = 1; b = 2; b", { scope: {} });     // 2
```

## Ce qui va dans `options`

`evaluate` accepte à la fois les options du **parser** et celles de
**l'évaluateur** dans le même objet :

- `ParseOptions` — `allowComments`, `allowTrailingCommas`,
  `allowSingleQuotes`, `allowUnquotedKeys`, `allowTemplates`,
  `allowBigInt`, `allowEmptySource`, `strictMode`, `maxDepth`,
  `maxStringLength`. Voir [mode données](./data-mode.md) pour le
  détail.
- `EvaluateOptions` :
  - `scope` — l'objet racine utilisé pour la résolution d'identifiants.
    Par défaut `{}`.
  - `policy` — la politique de sécurité. Voir [politique de
    sécurité](./security-policy.md) pour la surface complète.

`options.mode` est toujours forcé à `"eval"`. Passer `"data"` est
silencieusement ignoré — pour parser en mode données, utilise plutôt
[`parse`](./data-mode.md).

## Le scope

Le scope est la **racine** pour chaque identifiant qu'eden résout. Il
n'y a aucune notion de « variables ambiantes » en eden — si `Math`
n'est pas sur le scope, la source ne peut pas y accéder. C'est
volontaire : ça rend la mise en bac-à-sable triviale à raisonner.

```js
evaluate("Math.sqrt(4)", {
    scope:  { Math },
    policy: { allowFunctionCall: true, authorized: ["Math.*"] },
});
// 2
```

### Résolution d'identifiants et d'accès membre

- Un `Identifier` (`foo`) résout vers `scope.foo`.
- Un `MemberExpression` (`obj.x`, `arr[0]`) parcourt le path sur le
  scope.
- Un identifiant ou un chemin manquant lève `EdenReferenceError`.
- Descendre à travers `null` ou `undefined` lève aussi
  `EdenReferenceError`.
- Les primitives sont auto-boxées : `"hello".length` résout vers `5`
  même si l'étape intermédiaire est une chaîne.

### Affectation

```js
const scope = {};
evaluate("user.profile.name = \"Marc\"", { scope });
// scope === { user: { profile: { name: "Marc" } } }
```

L'affectation crée les objets intermédiaires manquants à la volée,
conformément à SPEC §5.2. Les clés numériques calculées (`arr[0]`)
ciblent une propriété d'objet ordinaire nommée `"0"`, **pas** un
élément d'`Array` — eden ne fabrique jamais d'instance JavaScript
`Array` à ta place.

Écrire à travers une primitive (`s.x = 1` quand `s = "hello"`) fait
remonter le `TypeError` natif de JavaScript.

## Appels et constructeurs

Les deux passent par la [politique de sécurité](./security-policy.md) :

```js
evaluate("new Date(\"2024-01-15\")", {
    scope: { Date },
});
// instance Date — `allowConstructor: true` + `"Date"` autorisés par défaut
```

Les appels de style membre (`obj.method(args)`) lient `this` à l'objet
parent : `obj.getX()` voit `this === obj`. Les appels d'identifiant
simples ont `this === undefined` (mode strict).

Un appel refusé retourne la valeur `undefineable` de la policy (par
défaut `undefined`) et déclenche le hook `onDenied` s'il est défini.

## Gestion d'erreur

```js
import {
    evaluate,
    EdenSyntaxError,
    EdenReferenceError,
} from "@ekameleon/eden";

try {
    evaluate("a.b.c", { scope: { a: {} } });
} catch (error) {
    if (error instanceof EdenReferenceError) {
        // "Path \"a.b\" is not defined in scope."
    }
}
```

Voir [erreurs](./errors.md) pour la hiérarchie complète.

## Références

- [Politique de sécurité](./security-policy.md)
- [Mode données — `parse` / `parseToAST`](./data-mode.md)
- [Erreurs](./errors.md)
- Sémantique normative : [`SPEC.md §5`](../../SPEC.md)
