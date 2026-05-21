# eden — Documentation (français)

Documentation française de la bibliothèque **eden**.
La grammaire et la sémantique d'exécution sont définies de manière
normative dans [`SPEC.md`](../../SPEC.md) ; l'API publique et
l'organisation des modules sont décrites dans
[`ARCHITECTURE.md`](../../ARCHITECTURE.md). Cette arborescence est
dédiée à **l'utilisation** d'eden depuis du code consommateur.

## Chapitres

### Pour commencer

- [Premiers pas](./getting-started.md) — installation, premier parsing, les deux modes
- [Mode données et mode évaluation](./data-mode.md) — le couple sûr `parse` / `stringify`
- [Mode évaluation](./evaluation-mode.md) — `evaluate`, scope, policy

### API publique

- [Mode données — `parse` et `parseToAST`](./data-mode.md)
- [Sérialisation — `stringify` et `stringifyAST`](./stringify.md)
- [Mode évaluation — `evaluate`](./evaluation-mode.md)
- [Politique de sécurité](./security-policy.md)
- [Interopérabilité JSON — `fromJSON` et `toJSON`](./json-interop.md)
- [Tokenize — le point d'entrée bas niveau du lexer](./tokenize.md)
- [Erreurs — hiérarchie typée](./errors.md)

### Spécificités du langage

- [Chaînes et templates](./strings-and-templates.md)
- [Nombres et BigInt](./numbers.md)
- [Objets et tableaux](./objects-and-arrays.md)
- [Commentaires](./comments.md)

### Référence pour les outils

- [Référence AST — formes des nœuds pour formatters et LSP](./ast-reference.md)

## Langue

- Version anglaise : [`doc/en/`](../en)
