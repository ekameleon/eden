/**
 * @file Factory for the `ObjectExpression` AST node.
 *
 * Corresponds to `{ key: value, ... }` in both data and eval modes
 * (SPEC.md §3.5). Duplicate keys are preserved in their source order;
 * deduplication (last-wins) is a concern for the consumer, matching
 * the ESTree convention.
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {object} ObjectExpression
 * @property {"ObjectExpression"}                          type
 * @property {Array<import("./createProperty.js").Property>} properties
 * @property {number}                                      offset
 * @property {number}                                      line
 * @property {number}                                      column
 */

/**
 * Creates an `ObjectExpression` AST node.
 *
 * @param   {Array<import("./createProperty.js").Property>} properties
 * @param   {number} offset
 * @param   {number} line
 * @param   {number} column
 * @returns {ObjectExpression}
 */
export default function createObjectExpression( properties , offset , line , column )
{
    return { type: NodeType.OBJECT_EXPRESSION , properties , offset , line , column } ;
}
