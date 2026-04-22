/**
 * @file Type-mismatch error raised by the parser / serializer /
 *       evaluator when a value is rejected for its type (not its
 *       syntactic shape, which is `EdenSyntaxError`'s domain).
 */

import EdenError from "./EdenError.js" ;

/**
 * Raised when a value is rejected because of its type rather than
 * because of a syntactic issue, as documented in SPEC.md §8 and
 * ARCHITECTURE.md §7.
 */
export default class EdenTypeError extends EdenError
{
    /**
     * @param {string}                                      message
     * @param {import("./EdenError.js").EdenErrorLocation} [location]
     */
    constructor( message , location )
    {
        super( message , location ) ;
        this.name = "EdenTypeError" ;
    }
}
