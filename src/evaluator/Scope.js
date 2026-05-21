/**
 * @file Runtime scope used by the evaluator.
 *
 * Wraps the root scope object supplied through
 * `EvaluateOptions.scope` and exposes the path-walking primitive
 * `resolve(path)` consumed by `Identifier` and `MemberExpression`
 * evaluation. Assignments mutate the underlying object in place
 * via the future `assign(path, value)` method (sub-step 6.5).
 */

import EdenReferenceError from "../errors/EdenReferenceError.js" ;

/**
 * Scope wrapper. The class is internal and not part of the public
 * API; consumers reach it transparently through the evaluator.
 */
export default class Scope
{
    /**
     * @param {object} [root] - Root object used for identifier resolution.
     */
    constructor( root )
    {
        this.#root = root ?? {} ;
    }

    /**
     * Walks `path` starting from the scope root and returns the
     * value reached at the end. Every intermediate step must yield
     * a value that supports property access (anything other than
     * `null` and `undefined`), and every segment must exist on the
     * (boxed) current value.
     *
     * Auto-boxing applies, so primitive intermediates like strings
     * or numbers transparently expose their wrapper-object members
     * (`"hello".length`, `(5).toFixed`, etc.). Array indices written
     * as numeric literals are coerced to their string form by the
     * caller (e.g. `arr[0]` → segment `"0"`), matching standard
     * JavaScript property semantics.
     *
     * @param   {string[]} path
     * @returns {*}
     * @throws  {EdenReferenceError} - On a missing segment or a descent
     *                                  through `null` / `undefined`.
     */
    resolve( path )
    {
        let current = this.#root ;

        for ( let i = 0 ; i < path.length ; i += 1 )
        {
            const segment = path[ i ] ;

            if ( current === null || current === undefined )
            {
                const consumed = path.slice( 0 , i ).join( "." ) ;
                throw new EdenReferenceError
                (
                    "Cannot read \"" + segment + "\" on "
                    + ( current === null ? "null" : "undefined" )
                    + " at path \"" + consumed + "\"."
                ) ;
            }

            if ( ! ( segment in Object( current ) ) )
            {
                const failed = path.slice( 0 , i + 1 ).join( "." ) ;
                throw new EdenReferenceError
                (
                    "Path \"" + failed + "\" is not defined in scope."
                ) ;
            }

            current = current[ segment ] ;
        }
        return current ;
    }

    /**
     * The underlying root object. Read-only accessor; the evaluator
     * mutates it directly for assignment statements (sub-step 6.5).
     *
     * @returns {object}
     */
    get root()
    {
        return this.#root ;
    }

    #root ;
}
