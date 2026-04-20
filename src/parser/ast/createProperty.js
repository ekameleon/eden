/**
 * @file Factory for the `Property` AST node (SPEC.md §3.5,
 *       ARCHITECTURE.md §4.6).
 *
 * A `Property` associates a key with a value inside an
 * `ObjectExpression`. Three variants exist:
 *   - long form (`key: value`) — the only form allowed in data mode;
 *   - shorthand (`{ name }`) — eval mode only;
 *   - computed (`{ [expr]: value }`) — eval mode only.
 *
 * The `shorthand` and `computed` flags discriminate the three
 * variants. The `key` node type varies accordingly: `Identifier` or
 * `Literal` for long form and shorthand, any expression node for
 * computed keys.
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {object} Property
 * @property {"Property"}  type
 * @property {object}      key
 * @property {object}      value
 * @property {boolean}     shorthand
 * @property {boolean}     computed
 * @property {number}      offset
 * @property {number}      line
 * @property {number}      column
 */

/**
 * Creates a `Property` AST node.
 *
 * @param   {object}  key
 * @param   {object}  value
 * @param   {boolean} shorthand
 * @param   {boolean} computed
 * @param   {number}  offset
 * @param   {number}  line
 * @param   {number}  column
 * @returns {Property}
 */
export default function createProperty( key , value , shorthand , computed , offset , line , column )
{
    return {
        type: NodeType.PROPERTY ,
        key ,
        value ,
        shorthand ,
        computed ,
        offset ,
        line ,
        column
    } ;
}
