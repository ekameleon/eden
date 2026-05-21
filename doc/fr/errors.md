# Erreurs — hiérarchie typée

Chaque erreur levée par eden étend `EdenError`, qui étend lui-même
l'`Error` natif. Tu peux attraper la classe de base pour un handler
générique, ou cibler une sous-classe précise pour réagir à un mode
de défaillance particulier.

## Hiérarchie

```
Error
└── EdenError                ← base de toutes les erreurs eden
    ├── EdenSyntaxError      ← lexer + parser (source malformée)
    ├── EdenReferenceError   ← évaluateur : identifiant / chemin non résolu
    ├── EdenSecurityError    ← réservée à un futur mode policy strict
    └── EdenTypeError        ← serializer non sérialisable, mauvais type
                               côté évaluateur, mauvaise utilisation d'API
```

Les cinq classes sont exportées depuis la façade publique :

```js
import {
    EdenError,
    EdenSyntaxError,
    EdenReferenceError,
    EdenSecurityError,
    EdenTypeError,
} from "@ekameleon/eden";
```

## Forme commune

Chaque erreur eden porte :

| Champ     | Type            | Sens                                                    |
|-----------|-----------------|---------------------------------------------------------|
| `message` | `string`        | Description lisible (en anglais).                       |
| `source`  | `string \| null` | Texte source concerné, quand on le connaît.            |
| `offset`  | `number \| null` | Offset zéro-indexé du premier caractère fautif.        |
| `line`    | `number \| null` | Numéro de ligne (un-indexé).                           |
| `column`  | `number \| null` | Numéro de colonne (un-indexé).                         |
| `cause`   | `Error \| null` | Erreur sous-jacente qui a déclenché celle-ci, le cas échéant. |
| `name`    | `string`        | Nom de la sous-classe (`"EdenSyntaxError"`, …).         |

Les champs de localisation sont à `null` quand on ne peut pas
rattacher la défaillance à une position précise (typiquement quand
c'est une mauvaise utilisation d'API).

## Quand chaque classe se lève

### `EdenSyntaxError`

Source mal formée. Levée par le lexer (caractère illégal, chaîne non
terminée, échappement illégal) et par le parser (token inattendu,
forme erronée, clé dupliquée en mode strict). `fromJSON` enveloppe
aussi le `SyntaxError` natif de `JSON.parse` dans cette classe.

```js
parse("{ unterminated"); // EdenSyntaxError à la ligne 1, colonne 15
```

### `EdenReferenceError`

Levée par l'évaluateur quand un identifiant ou un chemin membre
n'existe pas sur le scope, ou quand la descente passe par un
intermédiaire `null` ou `undefined`.

```js
evaluate("a.b.c", { scope: { a: {} } });
// EdenReferenceError: Path "a.b" is not defined in scope.
```

### `EdenSecurityError`

Réservée à un futur mode strict de la policy. La policy par défaut
retourne silencieusement `undefineable` et déclenche `onDenied` au
lieu de lever — voir [politique de sécurité](./security-policy.md).
Pour appliquer un échec dur aujourd'hui, le plus simple est de lever
toi-même depuis le hook `onDenied`.

### `EdenTypeError`

Deux familles de cas :

- **Valeur non sérialisable côté serializer.** `BigInt` en mode
  `jsonCompatible`, structures circulaires, profondeur excédée, type
  de nœud AST inconnu.
- **Mauvais type côté évaluateur.** Aujourd'hui, levée uniquement
  pour un type de nœud AST forgé inconnu.

```js
stringify(1n, { jsonCompatible: true });
// EdenTypeError: Cannot serialize BigInt in jsonCompatible mode.
```

## Attraper les erreurs

### Handler générique

```js
import { evaluate, EdenError } from "@ekameleon/eden";

try {
    evaluate(source, options);
} catch (error) {
    if (error instanceof EdenError) {
        log.warn("échec eden", {
            name:    error.name,
            line:    error.line,
            column:  error.column,
            message: error.message,
        });
    } else {
        throw error;     // laisser remonter les erreurs sans rapport
    }
}
```

### Réaction par classe

```js
import {
    parse,
    EdenSyntaxError,
} from "@ekameleon/eden";

try {
    parse(input);
} catch (error) {
    if (error instanceof EdenSyntaxError) {
        editor.markError(error.line, error.column, error.message);
    }
}
```

### Remonter la chaîne `cause`

```js
import { fromJSON } from "@ekameleon/eden";

try {
    fromJSON("{ not json }");
} catch (error) {
    // error instanceof EdenSyntaxError
    // error.cause instanceof SyntaxError
    console.log(error.cause.message); // message natif de JSON.parse
}
```

## Bonnes pratiques

- **Attrape `EdenError`** quand peu importe quelle étape a échoué
  (logging, télémétrie, fallback global).
- **Attrape la sous-classe** quand tu veux réagir à un mode précis —
  par exemple afficher un marqueur de syntaxe dans un éditeur
  uniquement sur `EdenSyntaxError`.
- **N'avale jamais un `EdenReferenceError` silencieusement en
  production**, à moins que le cas « identifiant manquant » soit
  intentionnel. Ça signale typiquement un décalage de configuration
  entre la source eden et le scope runtime.

## Références

- [Mode évaluation — `evaluate`](./evaluation-mode.md)
- [Politique de sécurité](./security-policy.md)
- Référence d'architecture : [`ARCHITECTURE.md §7`](../../ARCHITECTURE.md)
