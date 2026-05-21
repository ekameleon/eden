/**
 * @file Public `evaluate()` entry point — parses an eden source in
 *       eval mode and walks the resulting AST against the supplied
 *       runtime scope and security policy.
 *
 * The function is the eval-mode symmetric of `parse()` and the
 * caller-facing wrapper around the internal `evalAST()` helper.
 * `options.mode` is forced to `"eval"` — passing `"data"` is
 * silently overridden, since calling `evaluate()` already conveys
 * the intent unambiguously; callers wanting data-mode parsing
 * should use `parse()` instead.
 */

import ProgramMode from "../parser/ast/ProgramMode.js" ;
import parseToAST  from "../parser/parseToAST.js"      ;

import evalAST from "./helpers/evalAST.js" ;

/**
 * Evaluates a full eden program against a scope.
 *
 * `options` is the union of:
 *   - the parser surface (`ParseOptions`, e.g. `allowComments`,
 *     `allowBigInt`, `strictMode`, `maxDepth`, `maxStringLength`),
 *   - the evaluator surface (`scope`, `policy`).
 *
 * Both are forwarded as-is to their respective consumers; an
 * explicit `mode` in `options` is ignored and forced to `"eval"`.
 *
 * @param   {string} source
 * @param   {(import("./helpers/resolveEvaluateOptions.js").EvaluateOptions
 *          & import("../parser/helpers/resolveParseOptions.js").ParseOptions)} [options]
 * @returns {*}
 * @throws  {import("../errors/EdenSyntaxError.js").default}    - On malformed source.
 * @throws  {import("../errors/EdenReferenceError.js").default} - On an unresolved identifier or path.
 * @throws  {import("../errors/EdenTypeError.js").default}      - On a type mismatch raised by the evaluator.
 */
export default function evaluate( source , options )
{
    const ast = parseToAST(
        source ,
        { ...( options ?? {} ) , mode: ProgramMode.EVAL }
    ) ;
    return evalAST( ast , options ) ;
}
