/**
 * @file Internal serializer that turns a JavaScript value or an AST
 *       node into an eden source string.
 *
 * The serializer is a pure transformation: it never evaluates, never
 * resolves identifiers, never reaches into a runtime scope. It is the
 * mirror image of the parser, and a `parse(stringify(value))` round
 * trip is the contract that drives its design (see ARCHITECTURE.md
 * §2.3).
 *
 * Coverage as of sub-step 4.6: every AST node type produced by the
 * parser. The data-mode value space — scalar literals (`null`,
 * `undefined`, booleans, numbers, BigInts), strings and templates,
 * arrays, plain objects, `UnaryExpression`. The eval-mode surface —
 * `Identifier`, `MemberExpression`, `CallExpression`,
 * `NewExpression`, `AssignmentStatement`, multi-statement `Program`,
 * shorthand and computed `Property`. Every eval-mode shape is
 * unrepresentable in strict JSON and raises `EdenTypeError` under
 * `jsonCompatible`.
 *
 * The class is exposed within the package but is **not** part of the
 * public API — consumers should import `stringify()` or
 * `stringifyAST()` instead.
 */

import EdenTypeError                          from "../errors/EdenTypeError.js" ;
import LiteralKind                            from "../parser/ast/LiteralKind.js" ;
import NodeType                               from "../parser/ast/NodeType.js" ;
import ProgramMode                            from "../parser/ast/ProgramMode.js" ;
import canBeUnquotedKey                       from "./helpers/canBeUnquotedKey.js" ;
import computeIndentUnit                      from "./helpers/computeIndentUnit.js" ;
import isASTNode                              from "./helpers/isASTNode.js" ;
import resolveStringifyOptions                from "./helpers/resolveStringifyOptions.js" ;
import { quoteJSON , quoteString , quoteTemplate } from "./quoting.js" ;

/**
 * Non-negative decimal integer with no leading zero — the subset of
 * numeric strings that can be emitted as an unquoted property key
 * with a guaranteed lossless round-trip through the parser.
 */
const NUMERIC_KEY_RE = /^(0|[1-9][0-9]*)$/ ;

/**
 * Extracts the runtime string a `Property` AST key would resolve to.
 * Used by the `sortKeys` option to order properties consistently
 * with the order the corresponding runtime object exposes through
 * `Object.keys()`.
 *
 * @param   {import("../parser/ast/createProperty.js").Property} property
 * @returns {string}
 */
function propertyKeyString( property )
{
    const key = property.key ;
    if ( key.type === NodeType.IDENTIFIER )
    {
        return key.name ;
    }
    if ( key.type === NodeType.LITERAL )
    {
        return typeof key.value === "string" ? key.value : String( key.value ) ;
    }
    return "" ;
}

export default class Serializer
{
    /**
     * @param {import("./helpers/resolveStringifyOptions.js").StringifyOptions} [options]
     */
    constructor( options )
    {
        this.#options    = resolveStringifyOptions( options ) ;
        this.#indentUnit = computeIndentUnit( this.#options.indent ) ;
    }

    /**
     * Serializes either a runtime JavaScript value or an AST node.
     *
     * The dispatch is keyed on the shape of `input`: anything that
     * looks like an AST node (plain object with a string `type`) is
     * routed through the node path, everything else through the value
     * path.
     *
     * @param   {*} input
     * @returns {string}
     * @throws  {EdenTypeError} - On non-serializable inputs.
     */
    run( input )
    {
        if ( isASTNode( input ) )
        {
            return this.#serializeNode( input , "" ) ;
        }
        return this.#serializeValue( input , "" ) ;
    }

    #indentUnit ;
    #options ;

    /**
     * Renders the parenthesized argument list shared by `CallExpression`
     * and `NewExpression`. The list is always kept on a single line; only
     * the inter-argument separator follows the active indent mode
     * (`","` in compact form, `", "` in indented form).
     *
     * @param   {{type: string}[]} args
     * @param   {string}           prefix
     * @returns {string}
     */
    #renderArguments( args , prefix )
    {
        const sep   = this.#indentUnit === "" ? "," : ", " ;
        const parts = args.map( ( arg ) => this.#serializeNode( arg , prefix ) ) ;
        return "(" + parts.join( sep ) + ")" ;
    }

    /**
     * Lays out an array of pre-rendered items between brackets,
     * picking between the inline-compact form and the multi-line
     * indented form according to the current `indent` option.
     *
     * Inline form: `[a,b,c]` (no space after commas, no trailing
     * comma).
     *
     * Indented form: each item on its own line, prefixed by
     * `prefix + indentUnit`; closing bracket lines up with `prefix`.
     * A trailing comma is added on the last item iff
     * `options.trailingCommas` is set AND `jsonCompatible` is false.
     *
     * @param   {*[]}                       items
     * @param   {string}                    prefix       - Indentation prefix of the *enclosing* container.
     * @param   {(item: *, p: string) => string} renderItem - Per-item renderer; receives the child prefix.
     * @returns {string}
     */
    #renderArray( items , prefix , renderItem )
    {
        if ( items.length === 0 )
        {
            return "[]" ;
        }
        if ( this.#indentUnit === "" )
        {
            const parts = items.map( ( item ) => renderItem( item , prefix ) ) ;
            return "[" + parts.join( "," ) + "]" ;
        }

        const childPrefix = prefix + this.#indentUnit ;
        const parts       = items.map( ( item ) => renderItem( item , childPrefix ) ) ;
        const trailing    = this.#options.trailingCommas && ! this.#options.jsonCompatible
                            ? ","
                            : "" ;

        return "[\n"
             + childPrefix
             + parts.join( ",\n" + childPrefix )
             + trailing
             + "\n"
             + prefix
             + "]" ;
    }

    /**
     * Renders a property key from a runtime string `name`, choosing
     * between the unquoted identifier form, the unquoted numeric form
     * (decimal non-negative integers without leading zero), and the
     * quoted form. `jsonCompatible` always wins and forces a strict
     * JSON-quoted form.
     *
     * @param   {string} name
     * @returns {string}
     */
    #renderKey( name )
    {
        if ( this.#options.jsonCompatible )
        {
            return quoteJSON( name ) ;
        }
        if ( this.#options.unquotedKeys )
        {
            if ( canBeUnquotedKey( name )    ) { return name ; }
            if ( NUMERIC_KEY_RE.test( name ) ) { return name ; }
        }
        const quoteChar = this.#options.quotes === "single" ? "'" : "\"" ;
        return quoteString( name , quoteChar ) ;
    }

    /**
     * Lays out an array of pre-rendered entries between braces,
     * picking between the inline-compact form and the multi-line
     * indented form according to the current `indent` option.
     *
     * Inline form: `{a:1,b:2}` — no space after either `:` or `,`.
     *
     * Indented form: each entry on its own line, prefixed by
     * `prefix + indentUnit`, with one space after `:`. Closing brace
     * lines up with `prefix`. Trailing comma applied iff
     * `options.trailingCommas` is set AND `jsonCompatible` is false.
     *
     * @param   {*[]}                                items
     * @param   {string}                             prefix
     * @param   {(item: *, p: string) => string}     renderEntry - Per-entry renderer; receives the child prefix.
     * @returns {string}
     */
    #renderObject( items , prefix , renderEntry )
    {
        if ( items.length === 0 )
        {
            return "{}" ;
        }
        if ( this.#indentUnit === "" )
        {
            const parts = items.map( ( item ) => renderEntry( item , prefix ) ) ;
            return "{" + parts.join( "," ) + "}" ;
        }

        const childPrefix = prefix + this.#indentUnit ;
        const parts       = items.map( ( item ) => renderEntry( item , childPrefix ) ) ;
        const trailing    = this.#options.trailingCommas && ! this.#options.jsonCompatible
                            ? ","
                            : "" ;

        return "{\n"
             + childPrefix
             + parts.join( ",\n" + childPrefix )
             + trailing
             + "\n"
             + prefix
             + "}" ;
    }

    /**
     * Serializes an `ArrayExpression` AST node. Each element is
     * dispatched back through `#serializeNode`, so nested literals
     * keep their `raw` lexeme when applicable.
     *
     * @param   {import("../parser/ast/createArrayExpression.js").ArrayExpression} node
     * @param   {string} prefix - Indentation prefix of the enclosing container.
     * @returns {string}
     */
    #serializeArrayExpression( node , prefix )
    {
        return this.#renderArray(
            node.elements ,
            prefix ,
            ( child , childPrefix ) => this.#serializeNode( child , childPrefix )
        ) ;
    }

    /**
     * Serializes a runtime JavaScript array. Each element is
     * dispatched back through `#serializeValue`, which applies the
     * `jsonCompatible` substitutions (`undefined` / `NaN` / `±Infinity`
     * → `null`) at every position.
     *
     * @param   {*[]}    array
     * @param   {string} prefix - Indentation prefix of the enclosing container.
     * @returns {string}
     */
    #serializeArrayValue( array , prefix )
    {
        return this.#renderArray(
            array ,
            prefix ,
            ( child , childPrefix ) => this.#serializeValue( child , childPrefix )
        ) ;
    }

    /**
     * Serializes an `AssignmentStatement` AST node, with fixed spaces
     * around `=` for readability regardless of the active indent mode.
     *
     * Eval-mode shape, unrepresentable in strict JSON: raises
     * `EdenTypeError` under `jsonCompatible`.
     *
     * @param   {import("../parser/ast/createAssignmentStatement.js").AssignmentStatement} node
     * @param   {string} prefix
     * @returns {string}
     */
    #serializeAssignmentStatement( node , prefix )
    {
        if ( this.#options.jsonCompatible )
        {
            throw new EdenTypeError(
                "Serialization of AssignmentStatement requires eden, not strict JSON."
            ) ;
        }
        const { target , value } = node ;
        return this.#serializeNode( target , prefix )
             + " = "
             + this.#serializeNode( value , prefix ) ;
    }

    /**
     * Serializes a `BigInt` value.
     *
     * In `jsonCompatible` mode, BigInts cannot be represented in
     * strict JSON and raise `EdenTypeError`, mirroring the behavior
     * of `JSON.stringify`.
     *
     * @param   {bigint} value
     * @returns {string}
     */
    #serializeBigInt( value )
    {
        if ( this.#options.jsonCompatible )
        {
            throw new EdenTypeError(
                "Cannot serialize BigInt in jsonCompatible mode."
            ) ;
        }
        return `${ value.toString() }n` ;
    }

    /**
     * Serializes a `CallExpression` AST node. Eval-mode shape,
     * unrepresentable in strict JSON: raises `EdenTypeError` under
     * `jsonCompatible`.
     *
     * @param   {import("../parser/ast/createCallExpression.js").CallExpression} node
     * @param   {string} prefix
     * @returns {string}
     */
    #serializeCallExpression( node , prefix )
    {
        if ( this.#options.jsonCompatible )
        {
            throw new EdenTypeError(
                "Serialization of CallExpression requires eden, not strict JSON."
            ) ;
        }
        const { callee , arguments: args } = node ;
        return this.#serializeNode( callee , prefix )
             + this.#renderArguments( args , prefix ) ;
    }

    /**
     * Serializes an `Identifier` AST node. Eval-mode shape,
     * unrepresentable in strict JSON: raises `EdenTypeError` under
     * `jsonCompatible`.
     *
     * @param   {import("../parser/ast/createIdentifier.js").Identifier} node
     * @returns {string}
     */
    #serializeIdentifier( node )
    {
        if ( this.#options.jsonCompatible )
        {
            throw new EdenTypeError(
                "Serialization of Identifier requires eden, not strict JSON."
            ) ;
        }
        return node.name ;
    }

    /**
     * Serializes a `Literal` AST node, preserving the original `raw`
     * lexeme when available and the output is not constrained to
     * strict JSON. This keeps the round trip lossless for source
     * forms that share a single runtime value (for instance `0xFF`
     * and `255`, or `1_000n` and `1000n`).
     *
     * @param   {import("../parser/ast/createLiteral.js").Literal} node
     * @returns {string}
     */
    #serializeLiteralNode( node )
    {
        if ( node.kind === LiteralKind.STRING )
        {
            return this.#serializeStringLiteralNode( node ) ;
        }
        if ( node.kind === LiteralKind.TEMPLATE )
        {
            return this.#serializeTemplateLiteralNode( node ) ;
        }

        const hasRaw = typeof node.raw === "string" && node.raw.length > 0 ;

        if ( hasRaw && ! this.#options.jsonCompatible )
        {
            switch ( node.kind )
            {
                case LiteralKind.NUMBER :
                case LiteralKind.BIGINT :
                {
                    return node.raw ;
                }
                case LiteralKind.NULL      :
                case LiteralKind.UNDEFINED :
                case LiteralKind.BOOLEAN   :
                {
                    return node.raw ;
                }
            }
        }
        return this.#serializeValue( node.value , "" ) ;
    }

    /**
     * Serializes a `MemberExpression` AST node, picking between the
     * dotted form (`obj.prop`) and the computed form (`obj[key]`).
     *
     * For the computed form the property may be a `StringLiteral`
     * or a `NumericLiteral` per SPEC §3.3; both go through
     * `#serializeNode` so their `raw` lexeme is preserved.
     *
     * Eval-mode shape, unrepresentable in strict JSON: raises
     * `EdenTypeError` under `jsonCompatible`.
     *
     * @param   {import("../parser/ast/createMemberExpression.js").MemberExpression} node
     * @param   {string} prefix
     * @returns {string}
     */
    #serializeMemberExpression( node , prefix )
    {
        if ( this.#options.jsonCompatible )
        {
            throw new EdenTypeError(
                "Serialization of MemberExpression requires eden, not strict JSON."
            ) ;
        }
        const { object , property , computed } = node ;
        const base                             = this.#serializeNode( object , prefix ) ;

        if ( computed )
        {
            return base + "[" + this.#serializeNode( property , prefix ) + "]" ;
        }
        return base + "." + property.name ;
    }

    /**
     * Serializes a `NewExpression` AST node.
     *
     * When `arguments` is empty the output is the parenless form
     * `new Foo`, which is shorter and semantically equivalent to
     * `new Foo()`. The AST does not distinguish the two source
     * forms (the parser emits the same shape for both), so this
     * normalization is lossless with respect to the AST.
     *
     * Eval-mode shape, unrepresentable in strict JSON: raises
     * `EdenTypeError` under `jsonCompatible`.
     *
     * @param   {import("../parser/ast/createNewExpression.js").NewExpression} node
     * @param   {string} prefix
     * @returns {string}
     */
    #serializeNewExpression( node , prefix )
    {
        if ( this.#options.jsonCompatible )
        {
            throw new EdenTypeError(
                "Serialization of NewExpression requires eden, not strict JSON."
            ) ;
        }
        const { callee , arguments: args } = node ;
        const head                         = "new " + this.#serializeNode( callee , prefix ) ;

        if ( args && args.length > 0 )
        {
            return head + this.#renderArguments( args , prefix ) ;
        }
        return head ;
    }

    /**
     * Dispatches AST node serialization on `node.type`. Every node
     * type the parser can produce is supported as of sub-step 4.6;
     * an unknown `type` (forged by hand) still triggers the
     * defensive `default` branch and raises `EdenTypeError`.
     *
     * @param   {{type: string}} node
     * @param   {string}         prefix - Indentation prefix of the enclosing container.
     * @returns {string}
     */
    #serializeNode( node , prefix )
    {
        switch ( node.type )
        {
            case NodeType.PROGRAM :
            {
                return this.#serializeProgram(
                    /** @type {import("../parser/ast/createProgram.js").Program} */ ( node ) ,
                    prefix
                ) ;
            }
            case NodeType.LITERAL :
            {
                return this.#serializeLiteralNode(
                    /** @type {import("../parser/ast/createLiteral.js").Literal} */ ( node )
                ) ;
            }
            case NodeType.ARRAY_EXPRESSION :
            {
                return this.#serializeArrayExpression(
                    /** @type {import("../parser/ast/createArrayExpression.js").ArrayExpression} */ ( node ) ,
                    prefix
                ) ;
            }
            case NodeType.OBJECT_EXPRESSION :
            {
                return this.#serializeObjectExpression(
                    /** @type {import("../parser/ast/createObjectExpression.js").ObjectExpression} */ ( node ) ,
                    prefix
                ) ;
            }
            case NodeType.UNARY_EXPRESSION :
            {
                return this.#serializeUnaryExpression(
                    /** @type {import("../parser/ast/createUnaryExpression.js").UnaryExpression} */ ( node ) ,
                    prefix
                ) ;
            }
            case NodeType.IDENTIFIER :
            {
                return this.#serializeIdentifier(
                    /** @type {import("../parser/ast/createIdentifier.js").Identifier} */ ( node )
                ) ;
            }
            case NodeType.MEMBER_EXPRESSION :
            {
                return this.#serializeMemberExpression(
                    /** @type {import("../parser/ast/createMemberExpression.js").MemberExpression} */ ( node ) ,
                    prefix
                ) ;
            }
            case NodeType.CALL_EXPRESSION :
            {
                return this.#serializeCallExpression(
                    /** @type {import("../parser/ast/createCallExpression.js").CallExpression} */ ( node ) ,
                    prefix
                ) ;
            }
            case NodeType.NEW_EXPRESSION :
            {
                return this.#serializeNewExpression(
                    /** @type {import("../parser/ast/createNewExpression.js").NewExpression} */ ( node ) ,
                    prefix
                ) ;
            }
            case NodeType.ASSIGNMENT_STATEMENT :
            {
                return this.#serializeAssignmentStatement(
                    /** @type {import("../parser/ast/createAssignmentStatement.js").AssignmentStatement} */ ( node ) ,
                    prefix
                ) ;
            }
            default :
            {
                throw new EdenTypeError(
                    `Cannot serialize AST node of type "${ node.type }".`
                ) ;
            }
        }
    }

    /**
     * Serializes a finite or special number value.
     *
     * In `jsonCompatible` mode the IEEE-754 specials (`NaN`,
     * `±Infinity`) collapse to `null`, matching the SPEC §6.1 rule
     * already documented for array elements.
     *
     * @param   {number} value
     * @returns {string}
     */
    #serializeNumber( value )
    {
        if ( Number.isNaN( value ) )
        {
            return this.#options.jsonCompatible ? "null" : "NaN" ;
        }
        if ( value === Number.POSITIVE_INFINITY )
        {
            return this.#options.jsonCompatible ? "null" : "Infinity" ;
        }
        if ( value === Number.NEGATIVE_INFINITY )
        {
            return this.#options.jsonCompatible ? "null" : "-Infinity" ;
        }
        return String( value ) ;
    }

    /**
     * Serializes an `ObjectExpression` AST node.
     *
     * Property order is preserved by default. With `sortKeys: true`,
     * properties are reordered by the lexicographic order of their
     * *logical* key (the runtime string the key would resolve to),
     * matching what `Object.keys()` would return for the corresponding
     * runtime object.
     *
     * Under `jsonCompatible`, properties whose value is a Literal of
     * kind `undefined` are dropped (SPEC §6.1).
     *
     * @param   {import("../parser/ast/createObjectExpression.js").ObjectExpression} node
     * @param   {string} prefix
     * @returns {string}
     */
    #serializeObjectExpression( node , prefix )
    {
        let properties = node.properties ;

        if ( this.#options.jsonCompatible )
        {
            properties = properties.filter( ( p ) =>
                ! ( p.value
                 && p.value.type === NodeType.LITERAL
                 && p.value.kind === LiteralKind.UNDEFINED ) ) ;
        }

        if ( this.#options.sortKeys )
        {
            properties = [ ...properties ].sort( ( a , b ) =>
            {
                const ka = propertyKeyString( a ) ;
                const kb = propertyKeyString( b ) ;
                if ( ka < kb ) { return -1 ; }
                if ( ka > kb ) { return  1 ; }
                return 0 ;
            } ) ;
        }

        const separator = this.#indentUnit === "" ? ":" : ": " ;

        return this.#renderObject(
            properties ,
            prefix ,
            ( property , childPrefix ) =>
            {
                const { computed , shorthand , key , value } = property ;

                if ( shorthand )
                {
                    if ( this.#options.jsonCompatible )
                    {
                        throw new EdenTypeError(
                            "Shorthand properties require eden, not strict JSON."
                        ) ;
                    }
                    return key.name ;
                }
                if ( computed )
                {
                    if ( this.#options.jsonCompatible )
                    {
                        throw new EdenTypeError(
                            "Computed property keys require eden, not strict JSON."
                        ) ;
                    }
                    return "[" + this.#serializeNode( key , childPrefix ) + "]"
                         + separator
                         + this.#serializeNode( value , childPrefix ) ;
                }
                return this.#serializePropertyKey( key )
                     + separator
                     + this.#serializeNode( value , childPrefix ) ;
            }
        ) ;
    }

    /**
     * Serializes a runtime JavaScript plain object.
     *
     * Iterates own enumerable string keys via `Object.keys()` (so
     * Symbols are skipped, mirroring `JSON.stringify`). With
     * `sortKeys: true`, keys are sorted before emission. Under
     * `jsonCompatible`, entries whose value is `undefined` are
     * dropped (SPEC §6.1).
     *
     * @param   {object} obj
     * @param   {string} prefix
     * @returns {string}
     */
    #serializeObjectValue( obj , prefix )
    {
        let keys = Object.keys( obj ) ;

        if ( this.#options.jsonCompatible )
        {
            keys = keys.filter( ( k ) => obj[ k ] !== undefined ) ;
        }
        if ( this.#options.sortKeys )
        {
            keys = [ ...keys ].sort() ;
        }

        const separator = this.#indentUnit === "" ? ":" : ": " ;

        return this.#renderObject(
            keys ,
            prefix ,
            ( key , childPrefix ) =>
                this.#renderKey( key )
              + separator
              + this.#serializeValue( obj[ key ] , childPrefix )
        ) ;
    }

    /**
     * Serializes a `Program` node.
     *
     * Data-mode programs contain at most one value (SPEC §3.1); any
     * extra body element is a programming error and raises
     * `EdenTypeError`.
     *
     * Eval-mode programs contain zero or more statements (SPEC §3.2).
     * Statements are joined by `;` in compact form or by `\n` + the
     * current prefix in indented form. Eval-mode programs are
     * unrepresentable in strict JSON and raise `EdenTypeError` under
     * `jsonCompatible`.
     *
     * @param   {import("../parser/ast/createProgram.js").Program} node
     * @param   {string} prefix - Indentation prefix of the enclosing container (top-level is `""`).
     * @returns {string}
     */
    #serializeProgram( node , prefix )
    {
        const { mode , body } = node ;

        if ( body.length === 0 )
        {
            return "" ;
        }

        if ( mode === ProgramMode.EVAL )
        {
            if ( this.#options.jsonCompatible )
            {
                throw new EdenTypeError(
                    "Serialization of eval-mode programs requires eden, not strict JSON."
                ) ;
            }
            const separator = this.#indentUnit === "" ? ";" : "\n" + prefix ;
            const parts     = body.map( ( statement ) => this.#serializeNode( statement , prefix ) ) ;
            return parts.join( separator ) ;
        }

        if ( body.length > 1 )
        {
            throw new EdenTypeError(
                "Data-mode Program must contain exactly one value."
            ) ;
        }
        return this.#serializeNode( body[ 0 ] , prefix ) ;
    }

    /**
     * Serializes a `Property.key` AST node — used by
     * `#serializeObjectExpression` to emit the left-hand side of each
     * entry.
     *
     * Three node shapes are accepted in data mode:
     *   - `Identifier` — emitted unquoted under `unquotedKeys`, else
     *     quoted; `jsonCompatible` always quotes with double quotes.
     *   - `Literal { kind: "string" }` — delegated to the string
     *     literal path, which already applies the option-B raw
     *     preservation rule from sub-step 4.2.
     *   - `Literal { kind: "number" }` — original `raw` lexeme
     *     preserved (e.g. `0xFF`), or recomputed as a decimal when
     *     the value fits the unquoted numeric-key shape, otherwise
     *     quoted. `jsonCompatible` forces a JSON-quoted string of
     *     the runtime value.
     *
     * @param   {{ type: string, name?: string, value?: *, raw?: string, kind?: string }} keyNode
     * @returns {string}
     */
    #serializePropertyKey( keyNode )
    {
        if ( keyNode.type === NodeType.IDENTIFIER )
        {
            if ( this.#options.jsonCompatible )
            {
                return quoteJSON( keyNode.name ) ;
            }
            if ( this.#options.unquotedKeys )
            {
                return keyNode.name ;
            }
            const quoteChar = this.#options.quotes === "single" ? "'" : "\"" ;
            return quoteString( keyNode.name , quoteChar ) ;
        }

        if ( keyNode.type === NodeType.LITERAL )
        {
            if ( keyNode.kind === LiteralKind.STRING )
            {
                return this.#serializeStringLiteralNode( keyNode ) ;
            }
            if ( keyNode.kind === LiteralKind.NUMBER )
            {
                if ( this.#options.jsonCompatible )
                {
                    return quoteJSON( String( keyNode.value ) ) ;
                }
                if ( typeof keyNode.raw === "string" && keyNode.raw.length > 0 )
                {
                    return keyNode.raw ;
                }
                const asString = String( keyNode.value ) ;
                if ( NUMERIC_KEY_RE.test( asString ) )
                {
                    return asString ;
                }
                const quoteChar = this.#options.quotes === "single" ? "'" : "\"" ;
                return quoteString( asString , quoteChar ) ;
            }
        }

        throw new EdenTypeError(
            `Cannot serialize property key of type "${ keyNode.type }".`
        ) ;
    }

    /**
     * Serializes a `Literal` AST node of kind `string`.
     *
     * Preservation of the original `raw` lexeme follows option B
     * agreed for sub-step 4.2: the lexeme is kept only when its
     * opening quote matches the quote requested by the caller; any
     * mismatch (or `jsonCompatible`) triggers a recomputation from
     * `node.value`.
     *
     * @param   {import("../parser/ast/createLiteral.js").Literal} node
     * @returns {string}
     */
    #serializeStringLiteralNode( node )
    {
        if ( this.#options.jsonCompatible )
        {
            return quoteJSON( node.value ) ;
        }

        const requestedQuote = this.#options.quotes === "single" ? "'" : "\"" ;
        const raw            = node.raw ;

        if ( typeof raw === "string" && raw.length >= 2 && raw[ 0 ] === requestedQuote )
        {
            return raw ;
        }
        return quoteString( node.value , requestedQuote ) ;
    }

    /**
     * Serializes a runtime JavaScript `string` value, using the
     * caller-selected quote style. In `jsonCompatible` mode the
     * output is forced into strict JSON form.
     *
     * @param   {string} value
     * @returns {string}
     */
    #serializeStringValue( value )
    {
        if ( this.#options.jsonCompatible )
        {
            return quoteJSON( value ) ;
        }
        const quoteChar = this.#options.quotes === "single" ? "'" : "\"" ;
        return quoteString( value , quoteChar ) ;
    }

    /**
     * Serializes a `Literal` AST node of kind `template`.
     *
     * Template literals carry multi-line semantics (SPEC §2.10) and
     * are emitted as back-tick-quoted forms. In `jsonCompatible` mode
     * the template is downgraded to a strict JSON string, since JSON
     * has no template form.
     *
     * @param   {import("../parser/ast/createLiteral.js").Literal} node
     * @returns {string}
     */
    #serializeTemplateLiteralNode( node )
    {
        if ( this.#options.jsonCompatible )
        {
            return quoteJSON( node.value ) ;
        }

        const raw = node.raw ;

        if ( typeof raw === "string" && raw.length >= 2 && raw[ 0 ] === "`" )
        {
            return raw ;
        }
        return quoteTemplate( node.value ) ;
    }

    /**
     * Serializes a `UnaryExpression` AST node.
     *
     * In data mode the argument is always a `Literal` of kind
     * `number` or `bigint` (SPEC §3.1 `UnaryValue`); the standard
     * path emits `operator` followed by the recursively serialized
     * argument, which keeps the original `raw` lexeme (separators,
     * hex/binary/octal bases, etc.) thanks to `#serializeLiteralNode`.
     *
     * Under `jsonCompatible`, the effective numeric value is
     * computed up front so that `NaN` and `±Infinity` collapse to
     * `null` and `BigInt` raises `EdenTypeError` — otherwise we
     * would emit `-null`, which is not valid JSON.
     *
     * @param   {import("../parser/ast/createUnaryExpression.js").UnaryExpression} node
     * @param   {string} prefix
     * @returns {string}
     */
    #serializeUnaryExpression( node , prefix )
    {
        const { argument , operator }    = node ;
        const { type , kind , value }    = argument ?? {} ;

        if ( this.#options.jsonCompatible && type === NodeType.LITERAL )
        {
            const effective = operator === "-" ? -value : value ;

            if ( kind === LiteralKind.NUMBER )
            {
                return this.#serializeNumber( effective ) ;
            }
            if ( kind === LiteralKind.BIGINT )
            {
                return this.#serializeBigInt( effective ) ;
            }
        }

        return operator + this.#serializeNode( argument , prefix ) ;
    }

    /**
     * Serializes a runtime JavaScript value.
     *
     * Sub-steps 4.1 through 4.4 cover the full data-mode value space:
     * `null`, `undefined`, booleans, numbers, BigInts, strings,
     * arrays and plain objects.
     *
     * @param   {*}      value
     * @param   {string} prefix - Indentation prefix of the enclosing container.
     * @returns {string}
     */
    #serializeValue( value , prefix )
    {
        if ( value === null )
        {
            return "null" ;
        }
        if ( value === undefined )
        {
            return this.#options.jsonCompatible ? "null" : "undefined" ;
        }
        switch ( typeof value )
        {
            case "boolean" :
            {
                return value ? "true" : "false" ;
            }
            case "number" :
            {
                return this.#serializeNumber( value ) ;
            }
            case "bigint" :
            {
                return this.#serializeBigInt( value ) ;
            }
            case "string" :
            {
                return this.#serializeStringValue( value ) ;
            }
            case "object" :
            {
                if ( Array.isArray( value ) )
                {
                    return this.#serializeArrayValue( value , prefix ) ;
                }
                return this.#serializeObjectValue( value , prefix ) ;
            }
            default :
            {
                throw new EdenTypeError(
                    `Cannot serialize value of type "${ typeof value }".`
                ) ;
            }
        }
    }
}
