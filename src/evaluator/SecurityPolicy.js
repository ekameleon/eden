/**
 * @file Security policy gate for the evaluator.
 *
 * The policy controls **invocations** — function calls and
 * constructors — not plain reads. Once a value sits on the scope
 * the user explicitly placed it there, so reads are always
 * allowed; only `CallExpression` and `NewExpression` consult the
 * policy.
 *
 * Denial semantics follow ARCHITECTURE.md §6.3: the `onDenied`
 * hook (if any) is fired with the path that was denied, and the
 * configured `undefineable` value is returned. Default
 * `undefineable: undefined`, so denied calls silently no-op. Users
 * who want a hard failure can throw from `onDenied`.
 */

import matchAuthorizedGlob from "./helpers/matchAuthorizedGlob.js" ;

/**
 * Security policy. The class is internal and not part of the public
 * API; consumers reach it transparently through the evaluator.
 */
export default class SecurityPolicy
{
    /**
     * @param {import("./helpers/resolveEvaluateOptions.js").SecurityPolicyOptions} options
     */
    constructor( options )
    {
        this.#options = options ;
    }

    /**
     * Tells whether `path` may be invoked as a function. Requires
     * both `allowFunctionCall` to be true and `path` to match an
     * entry in `authorized`.
     *
     * @param   {string} path - Dotted path string, e.g. `"Math.sqrt"`.
     * @returns {boolean}
     */
    canCall( path )
    {
        const { allowFunctionCall , authorized } = this.#options ;
        return allowFunctionCall && matchAuthorizedGlob( path , authorized ) ;
    }

    /**
     * Tells whether `path` may be invoked as a constructor. Requires
     * both `allowConstructor` to be true and `path` to match an
     * entry in `authorized`.
     *
     * @param   {string} path
     * @returns {boolean}
     */
    canConstruct( path )
    {
        const { allowConstructor , authorized } = this.#options ;
        return allowConstructor && matchAuthorizedGlob( path , authorized ) ;
    }

    /**
     * Handles a denial: fires the `onDenied` hook (when set) and
     * returns the configured `undefineable` value. Callers use the
     * returned value as the runtime result of the denied
     * invocation.
     *
     * @param   {string} path
     * @returns {*}
     */
    handleDenial( path )
    {
        const { onDenied , undefineable } = this.#options ;
        if ( typeof onDenied === "function" )
        {
            onDenied( path ) ;
        }
        return undefineable ;
    }

    /**
     * The underlying options bag (read-only accessor).
     *
     * @returns {import("./helpers/resolveEvaluateOptions.js").SecurityPolicyOptions}
     */
    get options()
    {
        return this.#options ;
    }

    #options ;
}
