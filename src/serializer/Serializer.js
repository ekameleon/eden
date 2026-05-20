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
 * Coverage as of sub-step 4.3: scaffolding, scalar literals (`null`,
 * `undefined`, booleans, numbers, BigInts), strings and templates,
 * and arrays (both inline-compact and multi-line indented forms).
 * Objects, unary expressions and eval-mode nodes are wired in
 * subsequent sub-steps; encountering one of those raises
 * `EdenTypeError` with an explicit "not yet implemented" message so
 * callers fail loudly rather than silently dropping data.
 *
 * The class is exposed within the package but is **not** part of the
 * public API — consumers should import `stringify()` or
 * `stringifyAST()` instead.
 */

import EdenTypeError                          from "../errors/EdenTypeError.js" ;
import LiteralKind                            from "../parser/ast/LiteralKind.js" ;
import NodeType                               from "../parser/ast/NodeType.js" ;
import ProgramMode                            from "../parser/ast/ProgramMode.js" ;
import computeIndentUnit                      from "./helpers/computeIndentUnit.js" ;
import isASTNode                              from "./helpers/isASTNode.js" ;
import resolveStringifyOptions                from "./helpers/resolveStringifyOptions.js" ;
import { quoteJSON , quoteString , quoteTemplate } from "./quoting.js" ;

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
     * Dispatches AST node serialization on `node.type`. As of
     * sub-step 4.3, supported types are `Program`, `Literal` and
     * `ArrayExpression`; every other node type raises
     * `EdenTypeError` until its dedicated sub-step lands.
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
            default :
            {
                throw new EdenTypeError(
                    `Serialization of AST node "${ node.type }" is not yet implemented.`
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
     * Serializes a `Program` node. Data-mode programs with a body of
     * at most one element are accepted; the multi-statement eval-mode
     * path lands in sub-step 4.6.
     *
     * @param   {import("../parser/ast/createProgram.js").Program} node
     * @param   {string} prefix - Indentation prefix of the enclosing container (top-level is `""`).
     * @returns {string}
     */
    #serializeProgram( node , prefix )
    {
        if ( node.mode === ProgramMode.EVAL )
        {
            throw new EdenTypeError(
                "Serialization of eval-mode programs is not yet implemented."
            ) ;
        }
        if ( node.body.length === 0 )
        {
            return "" ;
        }
        if ( node.body.length > 1 )
        {
            throw new EdenTypeError(
                "Data-mode Program must contain exactly one value."
            ) ;
        }
        return this.#serializeNode( node.body[ 0 ] , prefix ) ;
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
     * Serializes a runtime JavaScript value.
     *
     * Sub-steps 4.1 through 4.3 cover `null`, `undefined`, booleans,
     * numbers, BigInts, strings and arrays. Plain objects raise
     * `EdenTypeError` until sub-step 4.4 lands.
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
                throw new EdenTypeError(
                    "Serialization of plain object values is not yet implemented."
                ) ;
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
