/**
 * @file Set of eden **operation keywords** per SPEC §2.6.
 *
 * Operation keywords are meaningful only in evaluation mode; the
 * lexer tokenizes them uniformly as `TokenType.KEYWORD` and leaves
 * mode-specific filtering to the parser.
 */

/**
 * Operation keywords recognized by the lexer and tokenized as
 * `TokenType.KEYWORD`. This set is internal to the library; consumers
 * should not rely on its identity.
 *
 * @type {Set<string>}
 */
const edenOperationKeywords = new Set(
[
    "new"
] ) ;

export default edenOperationKeywords ;
