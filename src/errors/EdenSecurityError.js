/**
 * @file Security error raised by the evaluator when a referenced
 *       path is rejected by the active `SecurityPolicy`.
 */

import EdenError from "./EdenError.js" ;

/**
 * Raised by the evaluator when an identifier resolution, function
 * call or constructor invocation is denied by the `SecurityPolicy`.
 * The policy is fail-closed, so any path not explicitly authorized
 * triggers this error. Documented in SPEC.md §5.5 and §8.
 */
export default class EdenSecurityError extends EdenError
{
    /**
     * @param {string}                                      message
     * @param {import("./EdenError.js").EdenErrorLocation} [location]
     */
    constructor( message , location )
    {
        super( message , location ) ;
        this.name = "EdenSecurityError" ;
    }
}
