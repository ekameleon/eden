/**
 * @file Factory for the `Literal` AST node.
 *
 * A `Literal` holds a fully-resolved JavaScript value alongside the
 * original source lexeme (`raw`) and a discriminant (`kind`). Unlike
 * token `value` strings, `Literal.value` is the native JS value ready
 * for consumption: escape sequences are applied, numeric separators
 * removed, hex/octal/binary converted to a `Number`, and so on.
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {"null" | "undefined" | "boolean" | "number" | "bigint" | "string" | "template"} LiteralKind
 *
 * @typedef {object} Literal
 * @property {"Literal"}                                                   type
 * @property {null | undefined | boolean | number | bigint | string}       value
 * @property {string}       raw     - Original lexeme as it appears in the source.
 * @property {LiteralKind}  kind    - Discriminant matching the source construct.
 * @property {number}       offset  - Zero-based source offset of the first character.
 * @property {number}       line    - One-based line number.
 * @property {number}       column  - One-based column number.
 */

/**
 * Creates a `Literal` AST node.
 *
 * @param   {null | undefined | boolean | number | bigint | string} value
 * @param   {string}      raw
 * @param   {LiteralKind} kind
 * @param   {number}      offset
 * @param   {number}      line
 * @param   {number}      column
 * @returns {Literal}
 */
export default function createLiteral( value , raw , kind , offset , line , column )
{
    return { type: NodeType.LITERAL , value , raw , kind , offset , line , column } ;
}
