/**
 * @file Hand-written character-level lexer for the eden grammar.
 *
 * The lexer is **total**: it segments any source that conforms to the
 * lexical grammar of SPEC.md §2 into a flat stream of `Token` objects,
 * **without** regard for mode (data/eval) or for user-facing options
 * such as `allowComments`, `allowTemplates`, or `allowBigInt`. All
 * feature filtering is a Parser-level concern.
 *
 * Design constraints (see CLAUDE.md §3 and ARCHITECTURE.md §10):
 *
 *   - Pure function of the input. No global state, no I/O, no scope.
 *   - No `eval`, no `Function`, no regex-driven top-level parsing.
 *     A small `\p{Zs}`/`\p{ID_*}` regex is allowed for Unicode class
 *     lookups.
 *   - Immutable output: once emitted, a token object is not mutated.
 *
 * The only error class raised by the lexer is `EdenSyntaxError`.
 */

import EdenSyntaxError from "../errors/EdenSyntaxError.js" ;
import TokenType       from "./TokenType.js" ;
import createToken     from "./createToken.js" ;

const LINE_FEED       = "\n" ;
const CARRIAGE_RETURN = "\r" ;
const LINE_SEPARATOR  = "\u2028" ;
const PARAGRAPH_SEP   = "\u2029" ;

const NBSP            = "\u00A0" ;
const BOM             = "\uFEFF" ;

const SPACE_SEPARATOR = /\p{Zs}/u ;

/**
 * Handwritten character-level lexer.
 *
 * The class is exposed within the package but is **not** part of the
 * public API — consumers should import `tokenize()` instead.
 */
export default class Lexer
{
    /** @type {string} */ #source ;
    /** @type {number} */ #length ;
    /** @type {number} */ #offset ;
    /** @type {number} */ #line ;
    /** @type {number} */ #column ;
    /** @type {import("./createToken.js").Token[]} */ #tokens ;

    /**
     * @param {string} source - The eden source text to tokenize.
     * @throws {TypeError}    - If `source` is not a string.
     */
    constructor( source )
    {
        if ( typeof source !== "string" )
        {
            throw new TypeError( "eden.tokenize: source must be a string." ) ;
        }

        this.#source = source ;
        this.#length = source.length ;
        this.#offset = 0 ;
        this.#line   = 1 ;
        this.#column = 1 ;
        this.#tokens = [] ;
    }

    /**
     * Runs the lexer over the full input and returns the token stream.
     * The returned array always ends with a single `EOF` token whose
     * position is the one past the last consumed character.
     *
     * @returns {import("./createToken.js").Token[]}
     * @throws  {EdenSyntaxError}
     */
    run()
    {
        while ( this.#offset < this.#length )
        {
            const char = this.#source[ this.#offset ] ;

            if ( this.#isLineTerminator( char ) )
            {
                this.#consumeLineTerminator( char ) ;
                continue ;
            }

            if ( this.#isWhitespace( char ) )
            {
                this.#advance() ;
                continue ;
            }

            this.#unexpected( char ) ;
        }

        this.#tokens.push( createToken(
            TokenType.EOF ,
            "" ,
            this.#offset ,
            this.#line ,
            this.#column
        ) ) ;

        return this.#tokens ;
    }

    /**
     * Returns `true` if the given character is recognized as white
     * space per SPEC.md §2.2.
     *
     * @param   {string} char
     * @returns {boolean}
     */
    #isWhitespace( char )
    {
        switch ( char )
        {
            case "\t" :
            case "\v" :
            case "\f" :
            case " "  :
            case NBSP :
            case BOM  :
                return true ;

            default :
                return SPACE_SEPARATOR.test( char ) ;
        }
    }

    /**
     * Returns `true` if the given character is a line terminator per
     * SPEC.md §2.3.
     *
     * @param   {string} char
     * @returns {boolean}
     */
    #isLineTerminator( char )
    {
        return (
            char === LINE_FEED       ||
            char === CARRIAGE_RETURN ||
            char === LINE_SEPARATOR  ||
            char === PARAGRAPH_SEP
        ) ;
    }

    /**
     * Consumes a line terminator. CRLF is treated as a single
     * terminator: the `\r` is consumed, and the following `\n` (if
     * any) is consumed alongside it without incrementing the line
     * counter a second time.
     *
     * @param {string} char
     */
    #consumeLineTerminator( char )
    {
        if ( char === CARRIAGE_RETURN && this.#source[ this.#offset + 1 ] === LINE_FEED )
        {
            this.#offset += 2 ;
        }
        else
        {
            this.#offset += 1 ;
        }

        this.#line  += 1 ;
        this.#column = 1 ;
    }

    /**
     * Advances the cursor by a single character (not a line
     * terminator). Updates `offset` and `column`; leaves `line`
     * unchanged.
     */
    #advance()
    {
        this.#offset += 1 ;
        this.#column += 1 ;
    }

    /**
     * Raises an `EdenSyntaxError` tagged with the current source
     * location.
     *
     * @param {string} char - The offending character.
     * @returns {never}
     */
    #unexpected( char )
    {
        const code = char.codePointAt( 0 ) ?? 0 ;
        const hex  = code.toString( 16 ).toUpperCase().padStart( 4 , "0" ) ;

        throw new EdenSyntaxError(
            `Unexpected character "${ char }" (U+${ hex }).` ,
            {
                source: this.#source ,
                offset: this.#offset ,
                line:   this.#line ,
                column: this.#column
            }
        ) ;
    }
}
