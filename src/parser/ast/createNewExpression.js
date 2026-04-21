/**
 * @file Factory for the `NewExpression` AST node.
 *
 * Represents a constructor invocation `new Callee(args)` per
 * SPEC.md §3.3. Arguments are optional; `new Date` is valid and
 * produces a `NewExpression` with an empty `arguments` array.
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {object} NewExpression
 * @property {"NewExpression"} type
 * @property {object}          callee
 * @property {Array<object>}   arguments
 * @property {number}          offset
 * @property {number}          line
 * @property {number}          column
 */

/**
 * Creates a `NewExpression` AST node.
 *
 * @param   {object}        callee
 * @param   {Array<object>} args
 * @param   {number}        offset
 * @param   {number}        line
 * @param   {number}        column
 * @returns {NewExpression}
 */
export default function createNewExpression( callee , args , offset , line , column )
{
    return {
        type: NodeType.NEW_EXPRESSION ,
        callee ,
        arguments: args ,
        offset ,
        line ,
        column
    } ;
}
