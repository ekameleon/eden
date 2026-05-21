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
 * Coverage as of sub-step 6.3: `Literal` of every `kind`,
 * `Program` (data or eval) with a body of length ≤ 1,
 * `Identifier` and `MemberExpression` reads, plus
 * `CallExpression` and `NewExpression` gated by the active
 * `SecurityPolicy`. Reads always pass; invocations require both
 * the matching policy flag (`allowFunctionCall` /
 * `allowConstructor`) and a `authorized` glob match, otherwise
 * the policy's `onDenied` hook fires and the configured
 * `undefineable` value is returned. Every other node type raises
 * `EdenTypeError` with an explicit "not yet implemented" message
 * so callers fail loudly rather than silently dropping data.
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
     * Walks an `Identifier` / `MemberExpression` chain and returns
     * the flat list of path segments to feed `Scope.resolve()`.
     *
     * Computed `MemberExpression` segments must be `Literal` of
     * kind `string` or `number` (SPEC §3.3); numeric values are
     * coerced to their string form so `arr[0]` and `arr["0"]` walk
     * the same path.
     *
     * @param   {{type: string}} node
     * @returns {string[]}
     */
    #collectPath( node )
    {
        const { type } = node ;

        if ( type === NodeType.IDENTIFIER )
        {
            return [ node.name ] ;
        }
        if ( type === NodeType.MEMBER_EXPRESSION )
        {
            const { object , property , computed } = node ;
            const head    = this.#collectPath( object ) ;
            const segment = computed
                ? String( property.value )
                : property.name ;
            return [ ...head , segment ] ;
        }
        throw new EdenTypeError(
            "Cannot use " + type + " as a member-path segment."
        ) ;
    }

    /**
     * Evaluates a `CallExpression` node.
     *
     * Arguments are evaluated left-to-right, eagerly, even when the
     * outer invocation is later denied by the policy. Cohérent
     * with the JavaScript call semantics and predictable for
     * callers that rely on side effects in argument expressions.
     *
     * Member-style calls (`obj.method(args)`) get `this` bound to
     * the parent object — `scope.resolve(path[:-1])`. Plain
     * identifier calls (`foo(args)`) leave `this` undefined.
     *
     * @param   {import("../parser/ast/createCallExpression.js").CallExpression} node
     * @returns {*}
     */
    #evaluateCallExpression( node )
    {
        const { callee , arguments: args } = node ;
        const path       = this.#collectPath( callee ) ;
        const pathString = path.join( "." ) ;

        const argValues  = args.map( ( arg ) => this.#evaluateNode( arg ) ) ;

        if ( ! this.#policy.canCall( pathString ) )
        {
            return this.#policy.handleDenial( pathString ) ;
        }

        const fn      = this.#scope.resolve( path ) ;
        const thisArg = callee.type === NodeType.MEMBER_EXPRESSION
            ? this.#scope.resolve( path.slice( 0 , -1 ) )
            : undefined ;

        return Reflect.apply( fn , thisArg , argValues ) ;
    }

    /**
     * Evaluates an `Identifier` node by resolving it as a one-segment
     * path against the scope.
     *
     * @param   {import("../parser/ast/createIdentifier.js").Identifier} node
     * @returns {*}
     */
    #evaluateIdentifier( node )
    {
        return this.#scope.resolve( [ node.name ] ) ;
    }

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
     * Evaluates a `MemberExpression` node by collecting its full
     * dotted/computed path and resolving it through the scope in a
     * single shot. Each path segment is a string — numeric indices
     * are coerced to their string form by `#collectPath`.
     *
     * @param   {import("../parser/ast/createMemberExpression.js").MemberExpression} node
     * @returns {*}
     */
    #evaluateMemberExpression( node )
    {
        return this.#scope.resolve( this.#collectPath( node ) ) ;
    }

    /**
     * Evaluates a `NewExpression` node.
     *
     * Like `#evaluateCallExpression`, arguments are evaluated
     * left-to-right and eagerly. The policy is consulted via
     * `canConstruct`; on denial the configured `undefineable` is
     * returned without instantiation.
     *
     * `Reflect.construct(Ctor, argValues)` is used so JavaScript's
     * native constructor semantics — including subclass detection,
     * `new.target`, and prototype binding — are preserved.
     *
     * @param   {import("../parser/ast/createNewExpression.js").NewExpression} node
     * @returns {*}
     */
    #evaluateNewExpression( node )
    {
        const { callee , arguments: args } = node ;
        const path       = this.#collectPath( callee ) ;
        const pathString = path.join( "." ) ;

        const argValues  = args.map( ( arg ) => this.#evaluateNode( arg ) ) ;

        if ( ! this.#policy.canConstruct( pathString ) )
        {
            return this.#policy.handleDenial( pathString ) ;
        }

        const Ctor = this.#scope.resolve( path ) ;
        return Reflect.construct( Ctor , argValues ) ;
    }

    /**
     * Dispatches AST evaluation on `node.type`. As of sub-step 6.3
     * supported types are `Program`, `Literal`, `Identifier`,
     * `MemberExpression`, `CallExpression` and `NewExpression`;
     * every other node type raises `EdenTypeError`.
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
            case NodeType.IDENTIFIER :
            {
                return this.#evaluateIdentifier(
                    /** @type {import("../parser/ast/createIdentifier.js").Identifier} */ ( node )
                ) ;
            }
            case NodeType.MEMBER_EXPRESSION :
            {
                return this.#evaluateMemberExpression(
                    /** @type {import("../parser/ast/createMemberExpression.js").MemberExpression} */ ( node )
                ) ;
            }
            case NodeType.CALL_EXPRESSION :
            {
                return this.#evaluateCallExpression(
                    /** @type {import("../parser/ast/createCallExpression.js").CallExpression} */ ( node )
                ) ;
            }
            case NodeType.NEW_EXPRESSION :
            {
                return this.#evaluateNewExpression(
                    /** @type {import("../parser/ast/createNewExpression.js").NewExpression} */ ( node )
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
