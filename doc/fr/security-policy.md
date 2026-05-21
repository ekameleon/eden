# Politique de sécurité

La politique de sécurité est la **passerelle** entre un programme
eden en mode évaluation et l'environnement hôte. Elle contrôle ce
qui peut être appelé et ce qui peut être instancié avec `new`. Les
lectures simples (identifiants et accès membres) **ne passent pas**
par la policy — l'utilisateur a déjà choisi ce qu'il expose en le
plaçant sur le scope.

La policy est **fail-closed** : chaque option est par défaut sur
« refuser » et l'utilisateur opte explicitement pour les chemins
qu'il autorise.

## Forme

```js
{
    allowFunctionCall: false,
    allowConstructor:  true,
    authorized:        [
        "Array", "Boolean", "Date", "Error",
        "Math.*", "Number.*", "Object", "String.*",
        "Infinity",
    ],
    undefineable: undefined,
    onDenied:     null,
}
```

| Champ               | Défaut      | Sens                                                                       |
|---------------------|-------------|----------------------------------------------------------------------------|
| `allowFunctionCall` | `false`     | Les appels de fonctions sont refusés sauf si `true` ET le chemin est autorisé. |
| `allowConstructor`  | `true`      | Les expressions `new` sont refusées sauf si `true` ET le chemin est autorisé. |
| `authorized`        | (voir au-dessus) | Patterns de glob des chemins invocables.                              |
| `undefineable`      | `undefined` | Valeur retournée à la place d'un appel refusé. Par défaut : `undefined` silencieux. |
| `onDenied`          | `null`      | Hook optionnel `(path) => void` exécuté avant de retourner `undefineable`. |

## Matching de glob

Deux formes sont reconnues :

- **Chemin exact** — `"Date"` matche le path `"Date"` et rien d'autre.
- **Wildcard en suffixe** — `"Math.*"` matche tout chemin commençant
  par `"Math."` (un **ou plusieurs** segments). `"Math.PI"`,
  `"Math.sqrt"`, `"Math.SubModule.fn"` matchent tous ; le `"Math"`
  seul **ne matche pas**.

Les wildcards en position intermédiaire (`"a.*.c"`) ne sont pas
supportés en v0.1.0.

Le matching est **sensible à la casse** : `"math"` ne matche pas
`"Math"`.

## Ce qu'on entend par « chemin »

Le chemin est **statique** — il vient de la source telle qu'elle est
écrite, pas de la valeur runtime. Pour :

```eden
d = new Date("2024-01-15")
d.getFullYear()
```

la seconde ligne invoque le chemin `"d.getFullYear"`. L'utilisateur
doit autoriser `"d.*"` (ou le chemin exact) pour que ça passe, même
si `d` contient une instance `Date`. C'est le compromis assumé d'une
policy fondée sur le chemin statique : c'est prévisible, mais ça
oblige à whitelister aussi les noms de variables.

## Comportement en cas de refus

Quand un appel est refusé :

1. `onDenied(path)` se déclenche, s'il est défini.
2. La valeur `undefineable` configurée est retournée (par défaut
   `undefined`).

Aucune exception n'est levée par défaut. Ça rend le refus facile à
englober dans du code défensif :

```js
evaluate("forbidden()", {
    scope: { forbidden: () => "secret" },
    // policy par défaut : allowFunctionCall est false → refusé
});
// retourne undefined ; rien ne fuit.
```

Si tu préfères une erreur dure, lève depuis le hook :

```js
policy: {
    onDenied(path) {
        throw new Error(`eden a refusé : ${path}`);
    },
}
```

## `undefineable` personnalisé

`undefineable` permet de **détecter** un refus au site d'appel :

```js
const DENIED = Symbol("denied");

const policy = {
    allowFunctionCall: false,
    authorized:        [],
    undefineable:      DENIED,
};

const result = evaluate("forbidden()", { scope: { forbidden: () => 1 }, policy });
if (result === DENIED) {
    // ... fallback explicite
}
```

## Recettes types

### Lecture seule stricte

```js
{
    allowFunctionCall: false,
    allowConstructor:  false,
    authorized:        [],
}
```

Le scope reste lisible, mais rien ne peut être appelé ni instancié.
Idéal pour évaluer une config typée qui peut référencer des
identifiants sans jamais exécuter de code.

### Utilitaires Math + Date

```js
{
    allowFunctionCall: true,
    allowConstructor:  true,
    authorized:        ["Math.*", "Number.*", "Date", "Date.*"],
}
```

Permet à la source d'utiliser `Math.sqrt(...)`, `Number.parseInt(...)`,
`new Date(...)`, et d'appeler les méthodes d'instance `Date` si la
variable est aussi whitelistée.

### Observabilité

```js
{
    onDenied(path) {
        telemetry.warn("eden.denied", { path });
    },
}
```

À combiner avec le retour silencieux par défaut pour **monitorer**
sans rien casser.

## Références

- [Mode évaluation — `evaluate`](./evaluation-mode.md)
- [Erreurs](./errors.md)
- Sémantique normative : [`SPEC.md §5.5`](../../SPEC.md)
- Référence d'architecture : [`ARCHITECTURE.md §6.3`](../../ARCHITECTURE.md)
