# Premiers pas

> **Statut.** La bibliothèque est en cours de développement actif. Cette
> page décrit comment installer eden et l'allure qu'aura l'API publique
> une fois les modules en place. Les appels à `parse`, `stringify` et
> `evaluate` deviendront fonctionnels au fur et à mesure de
> l'implémentation (voir la roadmap dans le
> [`README.md`](../../README.md) racine).

## Installation

```bash
npm install @ekameleon/eden
# ou
bun add @ekameleon/eden
```

### Depuis un CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@ekameleon/eden"></script>
<script>
    const value = eden.parse(`{ name: "Marc", tags: ["dev", "maker",] }`);
    console.log(value);
</script>
```

## Premier `parse`

```js
import { parse } from "@ekameleon/eden";

const source = `{
    // clés non quotées, virgules finales, commentaires
    name: "Marc",
    tags: ["dev", "maker",],
}`;

const value = parse(source);
// {
//     name: "Marc",
//     tags: ["dev", "maker"]
// }
```

Tout document JSON valide est aussi un document eden valide, avec la
même sémantique. Autrement dit, vous pouvez pointer `parse` sur
n'importe quel fichier JSON existant aujourd'hui, et migrer la syntaxe
vers le dialecte plus riche d'eden quand vous le souhaitez.

## Deux modes, une seule bibliothèque

- **Mode données** — `parse` / `stringify`. Sûr par défaut : pas de
  résolution d'identifiant, pas d'appel de fonction, pas d'expression
  `new`. C'est la surface compatible JSON.
- **Mode évaluation** — `evaluate`. Exécute un programme eden contre un
  `scope` explicite et une `policy`. Chaque accès est vérifié par la
  politique. À utiliser quand votre configuration a légitimement besoin
  de choses comme `new Date("2024-01-15")`.

Voir [`SPEC.md §1`](../../SPEC.md) pour la définition normative des
deux modes.

## Et ensuite

- Lisez [`SPEC.md`](../../SPEC.md) pour la grammaire complète.
- Lisez [`ARCHITECTURE.md`](../../ARCHITECTURE.md) pour la surface
  publique de l'API et la référence des options.
- Parcourez [`test/fixtures/parse/`](../../test/fixtures/parse) pour de
  petits exemples exécutables de la syntaxe supportée.
