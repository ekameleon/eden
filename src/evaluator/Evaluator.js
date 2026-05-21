/**
 * @file Internal evaluator that walks an eden AST and produces a
 *       runtime value.
 *
 * The evaluator is the only module allowed to touch the host
 * environment (scope, function calls, constructor invocations). It
 * is fail-closed: any operation denied by the active
 * `SecurityPolicy` raises `EdenSecurityError`, and any unresolved
 * identifier or path raises `EdenReferenceError`.
 *
 * Coverage as of sub-step 6.1: scaffolding only — `Literal` of
 * every `kind` and `Program` (data or eval) with a body of length
 * ≤ 1. Every other node type raises `EdenTypeError` with an
 * explicit "not yet implemented" message so callers fail loudly
 * rather than silently dropping data. The full surface lands sub-
 * step by sub-step through issue #6.
 *
 * The class is exposed within the package but is **not** part of
 * the public API — consumers should import the (future) `evaluate()`
 * entry point delivered by issue #7.
 */

import EdenTypeError            from "../errors/EdenTypeError.js" ;
import NodeType                 from "../parser/ast/NodeType.js" ;
import ProgramMode              from "../parser/ast/ProgramMode.js" ;
import Scope                    from "./Scope.js" ;
import SecurityPolicy           from "./SecurityPolicy.js" ;
import resolveEvaluateOptions   from "./helpers/resolveEvaluateOptions.js" ;

export default class Evaluator
{
    /**
     * @param {import("./helpers/resolveEvaluateOptions.js").EvaluateOptions} [options]
     */
    constructor( options )
    {
        const { scope , policy } = resolveEvaluateOptions( options ) ;
        this.#scope  = new Scope( scope ) ;
        this.#policy = new SecurityPolicy( policy ) ;
    }

    /**
     * Evaluates an AST node and returns the resulting runtime value.
     *
     * @param   {{type: string}} node
     * @returns {*}
     * @throws  {EdenTypeError} - On node shapes not yet supported.
     */
    run( node )
    {
        return this.#evaluateNode( node ) ;
    }

    #policy ;
    #scope ;

    /**
     * Evaluates a `Literal` node. The parser has already resolved
     * every escape sequence and numeric base, so the runtime value
     * is exactly `node.value`.
     *
     * @param   {import("../parser/ast/createLiteral.js").Literal} node
     * @returns {*}
     */
    #evaluateLiteral( node )
    {
        return node.value ;
    }

    /**
     * Dispatches AST evaluation on `node.type`. As of sub-step 6.1
     * only `Program` and `Literal` are supported; every other node
     * type raises `EdenTypeError`.
     *
     * @param   {{type: string}} node
     * @returns {*}
     */
    #evaluateNode( node )
    {
        switch ( node.type )
        {
            case NodeType.PROGRAM :
            {
                return this.#evaluateProgram(
                    /** @type {import("../parser/ast/createProgram.js").Program} */ ( node )
                ) ;
            }
            case NodeType.LITERAL :
            {
                return this.#evaluateLiteral(
                    /** @type {import("../parser/ast/createLiteral.js").Literal} */ ( node )
                ) ;
            }
            default :
            {
                throw new EdenTypeError(
                    `Evaluation of AST node "${ node.type }" is not yet implemented.`
                ) ;
            }
        }
    }

    /**
     * Evaluates a `Program` node.
     *
     * Data-mode programs hold at most one body element (SPEC §3.1).
     * Eval-mode programs hold zero or more statements (SPEC §3.2)
     * but only single-statement bodies are accepted in sub-step
     * 6.1 — the multi-statement path lands in sub-step 6.6.
     *
     * @param   {import("../parser/ast/createProgram.js").Program} node
     * @returns {*}
     */
    #evaluateProgram( node )
    {
        const { mode , body } = node ;

        if ( body.length === 0 )
        {
            return undefined ;
        }
        if ( body.length > 1 )
        {
            if ( mode === ProgramMode.EVAL )
            {
                throw new EdenTypeError(
                    "Evaluation of multi-statement eval-mode programs is not yet implemented."
                ) ;
            }
            throw new EdenTypeError(
                "Data-mode Program must contain exactly one value."
            ) ;
        }
        return this.#evaluateNode( body[ 0 ] ) ;
    }
}
