/**
 * @file Factory for the `CallExpression` AST node.
 *
 * Represents a function invocation `callee(args)` per SPEC.md §3.3.
 * The `callee` is always a `MemberPath` (`Identifier` or
 * `MemberExpression`); chained calls and member access after a call
 * are intentionally not part of the eden grammar.
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {object} CallExpression
 * @property {"CallExpression"} type
 * @property {object}           callee
 * @property {Array<object>}    arguments
 * @property {number}           offset
 * @property {number}           line
 * @property {number}           column
 */

/**
 * Creates a `CallExpression` AST node.
 *
 * @param   {object}        callee
 * @param   {Array<object>} args
 * @param   {number}        offset
 * @param   {number}        line
 * @param   {number}        column
 * @returns {CallExpression}
 */
export default function createCallExpression( callee , args , offset , line , column )
{
    return {
        type: NodeType.CALL_EXPRESSION ,
        callee ,
        arguments: args ,
        offset ,
        line ,
        column
    } ;
}
