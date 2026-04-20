/**
 * @file Factory for the `Identifier` AST node.
 *
 * Represents a bare identifier, for instance an unquoted object
 * property key in data mode (SPEC.md §3.5) or a name reference in
 * eval mode (SPEC.md §3.3).
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {object} Identifier
 * @property {"Identifier"} type
 * @property {string}       name
 * @property {number}       offset
 * @property {number}       line
 * @property {number}       column
 */

/**
 * Creates an `Identifier` AST node.
 *
 * @param   {string} name
 * @param   {number} offset
 * @param   {number} line
 * @param   {number} column
 * @returns {Identifier}
 */
export default function createIdentifier( name , offset , line , column )
{
    return { type: NodeType.IDENTIFIER , name , offset , line , column } ;
}
