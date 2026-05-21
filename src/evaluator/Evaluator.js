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
 * Coverage as of sub-step 6.6: every AST node type the parser can
 * produce. Reads (`Identifier`, `MemberExpression`) always pass;
 * invocations (`CallExpression`, `NewExpression`) are gated by the
 * active `SecurityPolicy` — denial fires the `onDenied` hook and
 * returns the configured `undefineable` value. Composite shapes
 * (`ArrayExpression`, `ObjectExpression`, `UnaryExpression`) walk
 * their sub-nodes left-to-right. `Program` in eval mode handles
 * any number of statements and returns the value of the last
 * non-assignment expression (SPEC §3.2).
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
     * Evaluates an `ArrayExpression` node by walking the elements
     * left-to-right and returning a fresh JavaScript array of the
     * resulting values.
     *
     * @param   {import("../parser/ast/createArrayExpression.js").ArrayExpression} node
     * @returns {*[]}
     */
    #evaluateArrayExpression( node )
    {
        return node.elements.map( ( element ) => this.#evaluateNode( element ) ) ;
    }

    /**
     * Evaluates an `AssignmentStatement` node.
     *
     * The target is always an `Identifier` or a `MemberExpression`
     * (ARCHITECTURE.md §4.10); `#collectPath` walks both shapes
     * uniformly. The right-hand side is evaluated first, then
     * `Scope.assign` writes it at the resolved path, creating any
     * missing intermediate object on the way (SPEC §5.2).
     *
     * The expression evaluates to the assigned value, mirroring
     * JavaScript's `=` semantics.
     *
     * @param   {import("../parser/ast/createAssignmentStatement.js").AssignmentStatement} node
     * @returns {*}
     */
    #evaluateAssignmentStatement( node )
    {
        const { target , value } = node ;
        const path     = this.#collectPath( target ) ;
        const resolved = this.#evaluateNode( value ) ;
        return this.#scope.assign( path , resolved ) ;
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
     * Every AST node type produced by the parser is supported as
     * of sub-step 6.6; an unknown `type` (forged by hand) still
     * triggers the defensive `default` branch and raises
     * `EdenTypeError`.
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
            case NodeType.ASSIGNMENT_STATEMENT :
            {
                return this.#evaluateAssignmentStatement(
                    /** @type {import("../parser/ast/createAssignmentStatement.js").AssignmentStatement} */ ( node )
                ) ;
            }
            case NodeType.ARRAY_EXPRESSION :
            {
                return this.#evaluateArrayExpression(
                    /** @type {import("../parser/ast/createArrayExpression.js").ArrayExpression} */ ( node )
                ) ;
            }
            case NodeType.OBJECT_EXPRESSION :
            {
                return this.#evaluateObjectExpression(
                    /** @type {import("../parser/ast/createObjectExpression.js").ObjectExpression} */ ( node )
                ) ;
            }
            case NodeType.UNARY_EXPRESSION :
            {
                return this.#evaluateUnaryExpression(
                    /** @type {import("../parser/ast/createUnaryExpression.js").UnaryExpression} */ ( node )
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
     * Evaluates an `ObjectExpression` node by walking each
     * `Property` in source order and producing a fresh JavaScript
     * object. Three property shapes are recognized:
     *
     *   - **longhand** (`key: value`) — `key` is an `Identifier`
     *     (taking `.name`) or a `Literal` of kind `string` or
     *     `number` (taking its value, coerced to a string for
     *     numbers).
     *   - **shorthand** (`{ foo }`, eval mode) — equivalent to
     *     `{ foo: foo }`: the identifier is looked up on the scope
     *     and reused as both key and value.
     *   - **computed** (`{ [expr]: value }`, eval mode) — the key
     *     expression is evaluated and coerced to a string, then
     *     used as the property name.
     *
     * @param   {import("../parser/ast/createObjectExpression.js").ObjectExpression} node
     * @returns {object}
     */
    #evaluateObjectExpression( node )
    {
        const result = {} ;

        for ( const property of node.properties )
        {
            const { key , value , shorthand , computed } = property ;

            if ( shorthand )
            {
                result[ key.name ] = this.#evaluateIdentifier( key ) ;
                continue ;
            }
            if ( computed )
            {
                const evaluatedKey = this.#evaluateNode( key ) ;
                result[ String( evaluatedKey ) ] = this.#evaluateNode( value ) ;
                continue ;
            }
            result[ this.#propertyKeyToString( key ) ] = this.#evaluateNode( value ) ;
        }
        return result ;
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

        if ( mode === ProgramMode.EVAL )
        {
            // SPEC §3.2: "The program result is the value of the
            // last expression evaluated, or undefined if the
            // program contains only assignments." Every statement
            // runs for its side effects; only non-assignment
            // statements contribute to the visible result.
            let result = undefined ;
            for ( const statement of body )
            {
                const value = this.#evaluateNode( statement ) ;
                if ( statement.type !== NodeType.ASSIGNMENT_STATEMENT )
                {
                    result = value ;
                }
            }
            return result ;
        }

        if ( body.length > 1 )
        {
            throw new EdenTypeError(
                "Data-mode Program must contain exactly one value."
            ) ;
        }
        return this.#evaluateNode( body[ 0 ] ) ;
    }

    /**
     * Evaluates a `UnaryExpression` node by evaluating its argument
     * and applying the unary operator. Coercion follows JavaScript:
     * `-` on a `BigInt` yields the negated BigInt, `+` on a `BigInt`
     * raises the native `TypeError` (BigInts cannot be cast to
     * Number this way) — both intentional, matching the host
     * semantics expected from eden eval mode.
     *
     * @param   {import("../parser/ast/createUnaryExpression.js").UnaryExpression} node
     * @returns {*}
     */
    #evaluateUnaryExpression( node )
    {
        const argument = this.#evaluateNode( node.argument ) ;
        return node.operator === "-" ? -argument : +argument ;
    }

    /**
     * Returns the runtime string a longhand `Property.key` resolves
     * to. Mirrors the helper used by the serializer for sorting and
     * keeps the two layers in sync without crossing a module
     * boundary.
     *
     * @param   {{type: string, name?: string, value?: *, kind?: string}} keyNode
     * @returns {string}
     */
    #propertyKeyToString( keyNode )
    {
        if ( keyNode.type === NodeType.IDENTIFIER )
        {
            return keyNode.name ;
        }
        if ( keyNode.type === NodeType.LITERAL )
        {
            return typeof keyNode.value === "string"
                ? keyNode.value
                : String( keyNode.value ) ;
        }
        throw new EdenTypeError(
            "Cannot use AST node \"" + keyNode.type + "\" as a property key."
        ) ;
    }
}
