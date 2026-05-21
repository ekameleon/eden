/**
 * @file Reference error raised by the evaluator when an identifier
 *       or member path cannot be resolved against the active scope.
 */

import EdenError from "./EdenError.js" ;

/**
 * Raised by the evaluator when a referenced identifier or member
 * path does not exist on the scope. Documented in SPEC.md §8 and
 * ARCHITECTURE.md §7.
 */
export default class EdenReferenceError extends EdenError
{
    /**
     * @param {string}                                      message
     * @param {import("./EdenError.js").EdenErrorLocation} [location]
     */
    constructor( message , location )
    {
        super( message , location ) ;
        this.name = "EdenReferenceError" ;
    }
}
