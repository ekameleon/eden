/**
 * @file Factory for the `Program` AST node.
 *
 * `Program` is the root of every AST produced by the parser. In
 * data mode (`eden.parse`) it contains exactly one value node; in
 * eval mode (`eden.evaluate`) it contains a list of statement nodes.
 */

import NodeType from "./NodeType.js" ;

/**
 * @typedef {"data" | "eval"} ProgramMode
 *
 * @typedef {object} Program
 * @property {"Program"}     type
 * @property {ProgramMode}   mode
 * @property {Array<object>} body
 */

/**
 * Creates a `Program` AST node.
 *
 * @param   {ProgramMode}    mode  - `"data"` or `"eval"`.
 * @param   {Array<object>}  body  - Child nodes.
 * @returns {Program}
 */
export default function createProgram( mode , body )
{
    return { type: NodeType.PROGRAM , mode , body } ;
}
