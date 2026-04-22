/**
 * @file Enumeration of token types produced by the lexer.
 *
 * The string values follow the ESTree convention (CamelCase) so that
 * downstream tooling written against ESTree can identify eden tokens
 * with minimal adaptation. See ARCHITECTURE.md §3.
 */

/**
 * Enumeration of every token type produced by the lexer.
 *
 * The object is frozen to prevent accidental mutation at runtime; its
 * keys are the canonical identifiers used across the codebase, and
 * its values are the string discriminators carried by each `Token`.
 *
 * @type {Readonly<{
 *     PUNCTUATOR:    "Punctuator",
 *     KEYWORD:       "Keyword",
 *     IDENTIFIER:    "Identifier",
 *     NUMBER:        "Number",
 *     BIGINT:        "BigInt",
 *     STRING:        "String",
 *     TEMPLATE:      "Template",
 *     LINE_COMMENT:  "LineComment",
 *     BLOCK_COMMENT: "BlockComment",
 *     EOF:           "EOF"
 * }>}
 */
const TokenType = Object.freeze(
{
    PUNCTUATOR    : "Punctuator"    ,
    KEYWORD       : "Keyword"       ,
    IDENTIFIER    : "Identifier"    ,
    NUMBER        : "Number"        ,
    BIGINT        : "BigInt"        ,
    STRING        : "String"        ,
    TEMPLATE      : "Template"      ,
    LINE_COMMENT  : "LineComment"   ,
    BLOCK_COMMENT : "BlockComment"  ,
    EOF           : "EOF"
} ) ;

export default TokenType ;
