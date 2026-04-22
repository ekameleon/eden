/**
 * @file Public `parse()` entry point — the JSON-compatible surface.
 */

import EdenTypeError    from "../errors/EdenTypeError.js" ;
import ProgramMode      from "./ast/ProgramMode.js" ;
import parseToAST       from "./parseToAST.js" ;
import evaluateDataNode from "./helpers/evaluateDataNode.js" ;

/**
 * Parses a data-mode eden source and returns the resulting
 * JavaScript value, mirroring `JSON.parse`. Internally delegates to
 * `parseToAST()` and walks the resulting AST to produce the value.
 *
 * Passing `options.mode === "eval"` is an API misuse and raises
 * `EdenTypeError`; use `eden.evaluate()` for eval-mode sources.
 *
 * By default an empty source yields `undefined`. Set
 * `options.allowEmptySource: false` to make `parse("")` throw
 * `EdenSyntaxError` instead.
 *
 * @param   {string} source
 * @param   {import("./helpers/resolveParseOptions.js").ParseOptions} [options]
 * @returns {*}
 * @throws  {EdenTypeError}   - If `options.mode === "eval"`.
 * @throws  {import("../errors/EdenSyntaxError.js").default} - On malformed input.
 * @throws  {TypeError}       - If `source` is not a string.
 */
export default function parse( source , options )
{
    if ( options !== undefined && options.mode === ProgramMode.EVAL )
    {
        throw new EdenTypeError(
            "eden.parse() requires data mode. " +
            "Use eden.evaluate() for eval-mode sources."
        ) ;
    }

    const program = parseToAST( source , options ) ;

    if ( program.body.length === 0 )
    {
        return undefined ;
    }

    return evaluateDataNode( program.body[ 0 ] ) ;
}
