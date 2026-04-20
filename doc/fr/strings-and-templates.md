# Chaînes et templates

eden propose trois manières d'écrire une valeur de type chaîne. Elles
partagent les mêmes règles d'échappement ; les seules différences
tiennent au délimiteur et à la possibilité d'avoir des sauts de ligne
à l'intérieur.

## Trois délimiteurs

```eden
"chaîne entre guillemets doubles"
'chaîne entre guillemets simples'
`template literal`
```

| Délimiteur  | Sauts de ligne à l'intérieur    | Usage typique                    |
|-------------|----------------------------------|----------------------------------|
| `"..."`     | Interdits (utiliser `\n`)        | Compatible JSON, courts textes   |
| `'...'`     | Interdits (utiliser `\n`)        | Chaînes contenant des `"`        |
| `` `...` `` | **Préservés tels quels**         | Texte multi-lignes (SQL, prompts…) |

Les trois utilisent **le même** vocabulaire d'échappement.

## Séquences d'échappement

| Échappement | Produit                                            |
|-------------|----------------------------------------------------|
| `\'`        | `'`                                                |
| `\"`        | `"`                                                |
| `` \` ``    | `` ` ``                                            |
| `\\`        | `\`                                                |
| `\b`        | Backspace (U+0008)                                 |
| `\f`        | Form feed (U+000C)                                 |
| `\n`        | Saut de ligne (U+000A)                             |
| `\r`        | Retour chariot (U+000D)                            |
| `\t`        | Tabulation (U+0009)                                |
| `\v`        | Tabulation verticale (U+000B)                      |
| `\0`        | NUL (U+0000) — interdit devant un chiffre          |
| `\xHH`      | Échappement hex, deux chiffres hex                 |
| `\uHHHH`    | Échappement Unicode, quatre chiffres hex           |
| `\u{H...H}` | Échappement Unicode, 1 à 6 chiffres hex, ≤ U+10FFFF |

Toute autre séquence (`\q`, `\z`, …) lève `EdenSyntaxError`. Les
échappements octaux hérités (`\00`, `\12`, …) sont rejetés.

## Continuation de ligne

Un antislash suivi immédiatement d'un terminateur de ligne est consommé
comme **continuation de ligne** : ni l'antislash ni le terminateur
n'apparaissent dans la chaîne résultante. Pratique pour découper des
littéraux longs sans ajouter un vrai saut de ligne.

```eden
{
    sql: "SELECT * \
FROM users",
}
```

La continuation de ligne est utilisable avec les trois styles de
délimiteurs (même si elle est rarement utile dans un template, qui est
déjà multi-lignes par nature).

## `${...}` dans un template — toujours littéral

> ⚠️ **C'est le seul endroit où eden s'écarte de JavaScript.**

En JavaScript, un template literal évalue chaque `${expression}` de son
corps. **eden ne le fait jamais.** La séquence est préservée comme
texte littéral.

```eden
{
    greeting: `Hello ${name}, welcome!`,
}
```

Après `eden.parse(...)`, la valeur de `greeting` est la chaîne de 28
caractères `Hello ${name}, welcome!` — **exactement** ce qui est
écrit, avec le `$`, les `{`, les `}` et le reste.

### Pourquoi

eden est un **format d'échange de données**, pas un runtime. Le parser
doit pouvoir tourner sur un input non fiable sans effet de bord, et
eden est portable d'un langage à l'autre (un portage PHP partage les
mêmes fixtures de conformance). Interpréter `${expression}` voudrait
dire exécuter du code au moment du parse — ce qui casse ces deux
garanties.

### À quoi ça sert concrètement

Les templates sont l'endroit idéal pour transporter du texte qui sera
**rendu plus tard** par un autre système : Mustache, Handlebars,
`lodash.template`, `envsubst` côté shell, renderers de prompts pour
LLM, etc. eden amène le texte intact jusqu'au consommateur, et le
consommateur fait l'interpolation avec ses propres règles.

Exemples :

```eden
{
    // Requête SQL avec placeholders résolus plus tard par le driver
    // ou par un moteur de templating qui utilise ${...} comme syntaxe.
    sqlInsert: `INSERT INTO users (name, email)
                VALUES (${name}, ${email})`,

    // Template de prompt passé à un renderer LLM qui sait lire ${...}.
    promptTemplate: `Summarize the following text:
                     ---
                     ${input}
                     ---`,

    // Snippet de shell script consommé par envsubst.
    envPreamble: `export VERSION=${VERSION}
                  export BUILD=${BUILD_NUMBER}`,
}
```

Si `eden.parse()` levait une erreur sur `${...}`, rien de ce qui est
ci-dessus ne serait exprimable en littéral multi-lignes.

### Et si je voulais qu'eden interpole vraiment ?

Non. Et ce n'est pas prévu pour plus tard non plus. eden reste un
format de données — l'interpolation est la responsabilité de
l'application qui consomme la donnée, pas du format. Si tu veux des
variables résolues, fais passer la valeur parsée dans le moteur de
templating de ton choix.

## Références

- Référence de grammaire : [`SPEC.md` §2.9](../../SPEC.md) (strings)
  et [`SPEC.md` §2.10](../../SPEC.md) (templates)
- Comportement du lexer : [`ARCHITECTURE.md` §3](../../ARCHITECTURE.md)
