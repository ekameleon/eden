/**
 * @file Security policy gate for the evaluator.
 *
 * As of sub-step 6.1 this class is a thin wrapper that holds the
 * resolved policy options. The actual allow/deny logic (glob
 * matching against the `authorized` list, `allowFunctionCall` /
 * `allowConstructor` checks, `onDenied` hook) lands in sub-step
 * 6.3 — keeping the file in place now fixes the import paths for
 * the rest of the evaluator surface and avoids a noisy refactor
 * later.
 */

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
