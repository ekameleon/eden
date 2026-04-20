/**
 * @file Syntax error raised by the lexer and the parser when the
 *       source text does not conform to the eden grammar.
 */

import EdenError from "./EdenError.js" ;

/**
 * Raised by the lexer and the parser when the source text violates
 * the eden grammar defined in SPEC.md §2 and §3.
 */
export default class EdenSyntaxError extends EdenError
{
    /**
     * @param {string}                                      message
     * @param {import("./EdenError.js").EdenErrorLocation} [location]
     */
    constructor( message , location )
    {
        super( message , location ) ;
        this.name = "EdenSyntaxError" ;
    }
}
