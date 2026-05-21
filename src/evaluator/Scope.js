/**
 * @file Runtime scope used by the evaluator.
 *
 * As of sub-step 6.1 this class is a thin wrapper that holds the
 * root scope object supplied through `EvaluateOptions.scope`. The
 * resolution logic (`resolve(path)` and friends) lands in sub-step
 * 6.2 — keeping the file in place now fixes the import paths for
 * the rest of the evaluator surface and avoids a noisy refactor
 * later.
 */

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
