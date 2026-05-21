/**
 * @file Internal `evalAST()` helper — runs the `Evaluator` on an
 *       AST node and returns the resulting runtime value.
 *
 * The function is the symmetric of `parseToAST()` and
 * `stringifyAST()`: it operates on the AST level and stays out of
 * the public surface for now. The public `evaluate(source, options)`
 * entry point delivered by issue #7 will wrap this helper together
 * with `parseToAST()`.
 */

import Evaluator from "../Evaluator.js" ;

/**
 * Evaluates an AST node against the supplied `EvaluateOptions`.
 *
 * @param   {{type: string}}                                              ast
 * @param   {import("./resolveEvaluateOptions.js").EvaluateOptions} [options]
 * @returns {*}
 */
export default function evalAST( ast , options )
{
    return new Evaluator( options ).run( ast ) ;
}
