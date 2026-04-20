/**
 * @file Public `parseToAST()` entry point.
 */

import tokenize from "../lexer/tokenize.js" ;
import Parser   from "./Parser.js" ;

/**
 * Parses an eden source string into a `Program` AST. The function
 * is a thin wrapper that combines `tokenize()` and the internal
 * `Parser` class; consumers should use it (or the higher-level
 * `parse()` / `evaluate()`) rather than instantiating `Parser`
 * directly.
 *
 * @param   {string}  source    - The eden source text.
 * @param   {object}  [options] - Reserved for future use; currently ignored.
 * @returns {import("./ast/createProgram.js").Program}
 * @throws  {import("../errors/EdenSyntaxError.js").default} If the source is malformed.
 * @throws  {TypeError} If `source` is not a string.
 */
export default function parseToAST( source , options )
{
    const tokens = tokenize( source , options ) ;
    return new Parser( tokens , source , options ).parse() ;
}
