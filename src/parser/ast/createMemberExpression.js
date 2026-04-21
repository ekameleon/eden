/**
 * @file Factory for the `MemberExpression` AST node.
 *
 * Represents a member access `object.property` (`computed: false`)
 * or `object[literal]` (`computed: true`) per SPEC.md §3.3. In data
 * mode the parser never produces this node; it is an eval-mode
 * construct. The `computed: true` form restricts the property to a
 * `StringLiteral` or `NumericLiteral` (SPEC §3.3).
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {object} MemberExpression
 * @property {"MemberExpression"}                                         type
 * @property {object}                                                     object
 * @property {import("./createIdentifier.js").Identifier |
 *           import("./createLiteral.js").Literal}                        property
 * @property {boolean}                                                    computed
 * @property {number}                                                     offset
 * @property {number}                                                     line
 * @property {number}                                                     column
 */

/**
 * Creates a `MemberExpression` AST node.
 *
 * @param   {object}   object    - The receiver node.
 * @param   {object}   property  - `Identifier` (dot form) or `Literal` (bracket form).
 * @param   {boolean}  computed  - `true` when written with brackets.
 * @param   {number}   offset
 * @param   {number}   line
 * @param   {number}   column
 * @returns {MemberExpression}
 */
export default function createMemberExpression( object , property , computed , offset , line , column )
{
    return {
        type: NodeType.MEMBER_EXPRESSION ,
        object ,
        property ,
        computed ,
        offset ,
        line ,
        column
    } ;
}
