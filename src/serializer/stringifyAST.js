/**
 * @file Public `stringifyAST()` entry point — serializes an AST node
 *       (typically produced by `parseToAST()`) back to eden source.
 *
 * This is the formatter-oriented surface of the serializer: it
 * preserves the original `raw` lexeme on literals (unless
 * `jsonCompatible` is set) so that `stringifyAST( parseToAST( src ) )`
 * round-trips losslessly for literal forms that share a single
 * runtime value (`0xFF` vs `255`, `1_000n` vs `1000n`, etc.).
 */

import EdenTypeError from "../errors/EdenTypeError.js" ;
import Serializer    from "./Serializer.js" ;

/**
 * Serializes an AST node back to eden source.
 *
 * @param   {{type: string}}                                                     ast
 * @param   {import("./helpers/resolveStringifyOptions.js").StringifyOptions} [options]
 * @returns {string}
 * @throws  {EdenTypeError}
 *          If `ast` is not an AST-shaped object (plain object with a
 *          string `type` field), or if it references a node type not
 *          yet handled by the current sub-step.
 */
export default function stringifyAST( ast , options )
{
    if ( ast === null || typeof ast !== "object" || typeof ast.type !== "string" )
    {
        throw new EdenTypeError(
            "stringifyAST() expects an AST node (object with a string \"type\" field)."
        ) ;
    }
    return new Serializer( options ).run( ast ) ;
}
