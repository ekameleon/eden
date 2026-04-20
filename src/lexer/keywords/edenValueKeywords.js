/**
 * @file Set of eden **value keywords** — reserved identifiers whose
 *       lexeme maps directly to a literal value per SPEC §2.6 and §4.
 */

/**
 * Value keywords recognized by the lexer and tokenized as
 * `TokenType.KEYWORD`. This set is internal to the library; consumers
 * should not rely on its identity.
 *
 * @type {Set<string>}
 */
const edenValueKeywords = new Set(
[
    "null"      ,
    "true"      ,
    "false"     ,
    "undefined" ,
    "NaN"       ,
    "Infinity"
] ) ;

export default edenValueKeywords ;
