/**
 * @file Factory for the `ArrayExpression` AST node.
 *
 * Corresponds to the source construct `[ ... ]` in both data mode
 * and eval mode (SPEC.md §3.4). Elisions (`[1, , 3]`) are not
 * allowed by the grammar and therefore never appear as holes in
 * `elements`.
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {object} ArrayExpression
 * @property {"ArrayExpression"} type
 * @property {Array<object>}     elements
 * @property {number}            offset
 * @property {number}            line
 * @property {number}            column
 */

/**
 * Creates an `ArrayExpression` AST node.
 *
 * @param   {Array<object>} elements
 * @param   {number}        offset
 * @param   {number}        line
 * @param   {number}        column
 * @returns {ArrayExpression}
 */
export default function createArrayExpression( elements , offset , line , column )
{
    return { type: NodeType.ARRAY_EXPRESSION , elements , offset , line , column } ;
}
