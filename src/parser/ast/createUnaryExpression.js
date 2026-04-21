/**
 * @file Factory for the `UnaryExpression` AST node.
 *
 * Used in both data mode (`UnaryValue`, SPEC.md §3.1) and eval mode
 * (`UnaryExpression`, SPEC.md §3.3). In data mode the `argument`
 * must be a numeric `Literal` (including the `Infinity` / `NaN`
 * keywords); in eval mode any expression node is accepted.
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {"+" | "-"} UnaryOperator
 *
 * @typedef {object} UnaryExpression
 * @property {"UnaryExpression"} type
 * @property {UnaryOperator}     operator
 * @property {object}            argument
 * @property {number}            offset
 * @property {number}            line
 * @property {number}            column
 */

/**
 * Creates a `UnaryExpression` AST node.
 *
 * @param   {UnaryOperator} operator
 * @param   {object}        argument
 * @param   {number}        offset
 * @param   {number}        line
 * @param   {number}        column
 * @returns {UnaryExpression}
 */
export default function createUnaryExpression( operator , argument , offset , line , column )
{
    return { type: NodeType.UNARY_EXPRESSION , operator , argument , offset , line , column } ;
}
