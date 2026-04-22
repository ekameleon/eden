/**
 * @file Factory for the `AssignmentStatement` AST node.
 *
 * Represents an assignment statement `target = value` in eval mode
 * (SPEC.md §3.2). The `target` is restricted by the grammar to a
 * `MemberPath`, i.e. an `Identifier` or a `MemberExpression` in the
 * AST — any other node type is an invalid assignment target and is
 * rejected by the parser.
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {object} AssignmentStatement
 * @property {"AssignmentStatement"} type
 * @property {import("./createIdentifier.js").Identifier |
 *           import("./createMemberExpression.js").MemberExpression} target
 * @property {object} value
 * @property {number} offset
 * @property {number} line
 * @property {number} column
 */

/**
 * Creates an `AssignmentStatement` AST node.
 *
 * @param   {import("./createIdentifier.js").Identifier |
 *           import("./createMemberExpression.js").MemberExpression} target
 * @param   {object} value
 * @param   {number} offset
 * @param   {number} line
 * @param   {number} column
 * @returns {AssignmentStatement}
 */
export default function createAssignmentStatement( target , value , offset , line , column )
{
    return {
        type: NodeType.ASSIGNMENT_STATEMENT ,
        target ,
        value ,
        offset ,
        line ,
        column
    } ;
}
