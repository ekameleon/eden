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

import EdenSyntaxError          from "../errors/EdenSyntaxError.js" ;
import isIdentifierStart        from "../util/isIdentifierStart.js" ;
import isIdentifierPart         from "../util/isIdentifierPart.js" ;
import TokenType                from "./TokenType.js" ;
import createToken              from "./createToken.js" ;
import edenValueKeywords        from "./keywords/edenValueKeywords.js" ;
import edenOperationKeywords    from "./keywords/edenOperationKeywords.js" ;
import ecmascriptReservedWords  from "./keywords/ecmascriptReservedWords.js" ;

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

            if ( char === "/" )
            {
                const next = this.#source[ this.#offset + 1 ] ;
                if ( next === "/" )
                {
                    this.#readLineComment() ;
                    continue ;
                }
                if ( next === "*" )
                {
                    this.#readBlockComment() ;
                    continue ;
                }
                this.#unexpected( char ) ;
            }

            if ( this.#isPunctuatorStart( char ) )
            {
                this.#readPunctuator( char ) ;
                continue ;
            }

            const codePoint = this.#source.codePointAt( this.#offset ) ;
            const startChar = String.fromCodePoint( codePoint ) ;

            if ( isIdentifierStart( startChar ) )
            {
                this.#readIdentifier() ;
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
     * Returns `true` if `char` may start a punctuator token per
     * SPEC.md §2.5. The `"..."` token is handled in
     * `#readPunctuator()` via a two-character lookahead.
     *
     * Note: numeric literals starting with `.` (for example `.5`)
     * are not yet recognized; they will be handled in sub-step 4.
     *
     * @param   {string} char
     * @returns {boolean}
     */
    #isPunctuatorStart( char )
    {
        switch ( char )
        {
            case "{" : case "}" :
            case "[" : case "]" :
            case "(" : case ")" :
            case "," : case ":" : case ";" :
            case "." : case "=" :
            case "+" : case "-" :
                return true ;

            default :
                return false ;
        }
    }

    /**
     * Reads a single punctuator token starting at the current
     * offset and pushes it to the output stream. Handles the
     * three-character lookahead for `"..."`.
     *
     * @param {string} char - The first character of the punctuator.
     */
    #readPunctuator( char )
    {
        const startOffset = this.#offset ;
        const startLine   = this.#line ;
        const startColumn = this.#column ;

        let value = char ;

        if ( char === "." &&
             this.#source[ this.#offset + 1 ] === "." &&
             this.#source[ this.#offset + 2 ] === "." )
        {
            value = "..." ;
            this.#offset += 3 ;
            this.#column += 3 ;
        }
        else
        {
            this.#offset += 1 ;
            this.#column += 1 ;
        }

        this.#tokens.push( createToken(
            TokenType.PUNCTUATOR ,
            value ,
            startOffset ,
            startLine ,
            startColumn
        ) ) ;
    }

    /**
     * Reads a `//` line comment starting at the current offset.
     * The comment runs up to (but not including) the next line
     * terminator or end of input; the terminator itself is left
     * for the main loop to consume, so `#line` and `#column` are
     * updated correctly.
     */
    #readLineComment()
    {
        const startOffset = this.#offset ;
        const startLine   = this.#line ;
        const startColumn = this.#column ;

        let end = this.#offset ;
        while ( end < this.#length && !this.#isLineTerminator( this.#source[ end ] ) )
        {
            end += 1 ;
        }

        const value = this.#source.slice( startOffset , end ) ;
        this.#column += end - this.#offset ;
        this.#offset  = end ;

        this.#tokens.push( createToken(
            TokenType.LINE_COMMENT ,
            value ,
            startOffset ,
            startLine ,
            startColumn
        ) ) ;
    }

    /**
     * Reads a `/* ... *\/` block comment starting at the current
     * offset. Block comments do not nest (SPEC.md §2.4); the first
     * `*\/` encountered ends the comment. Embedded line
     * terminators (including CRLF) correctly update `#line` and
     * `#column`. If end-of-input is reached before the closing
     * `*\/`, an `EdenSyntaxError` is raised at the position of the
     * opening `/*`.
     */
    #readBlockComment()
    {
        const startOffset = this.#offset ;
        const startLine   = this.#line ;
        const startColumn = this.#column ;

        this.#offset += 2 ;
        this.#column += 2 ;

        while ( this.#offset < this.#length )
        {
            const ch = this.#source[ this.#offset ] ;

            if ( ch === "*" && this.#source[ this.#offset + 1 ] === "/" )
            {
                this.#offset += 2 ;
                this.#column += 2 ;

                const value = this.#source.slice( startOffset , this.#offset ) ;
                this.#tokens.push( createToken(
                    TokenType.BLOCK_COMMENT ,
                    value ,
                    startOffset ,
                    startLine ,
                    startColumn
                ) ) ;
                return ;
            }

            if ( this.#isLineTerminator( ch ) )
            {
                this.#consumeLineTerminator( ch ) ;
                continue ;
            }

            this.#offset += 1 ;
            this.#column += 1 ;
        }

        throw new EdenSyntaxError(
            "Unterminated block comment." ,
            {
                source: this.#source ,
                offset: startOffset ,
                line:   startLine ,
                column: startColumn
            }
        ) ;
    }

    /**
     * Reads an identifier-like lexeme starting at the current offset,
     * classifies it, and pushes the resulting token.
     *
     * Classification per SPEC.md §2.6:
     *   - eden value or operation keyword → `TokenType.KEYWORD`
     *   - other ECMAScript reserved word → `EdenSyntaxError`
     *     at the start position of the lexeme (forward-compat guard)
     *   - anything else → `TokenType.IDENTIFIER`
     *
     * The reader is code-point aware: it advances by two code units
     * when it encounters a character outside the BMP (surrogate pair).
     */
    #readIdentifier()
    {
        const startOffset = this.#offset ;
        const startLine   = this.#line ;
        const startColumn = this.#column ;

        let end = this.#offset ;

        const startCp   = this.#source.codePointAt( end ) ;
        const startChar = String.fromCodePoint( startCp ) ;
        end += startChar.length ;

        while ( end < this.#length )
        {
            const cp  = this.#source.codePointAt( end ) ;
            const chr = String.fromCodePoint( cp ) ;

            if ( !isIdentifierPart( chr ) )
            {
                break ;
            }

            end += chr.length ;
        }

        const value    = this.#source.slice( startOffset , end ) ;
        const advanced = end - startOffset ;

        this.#offset  = end ;
        this.#column += advanced ;

        if ( edenValueKeywords.has( value ) || edenOperationKeywords.has( value ) )
        {
            this.#tokens.push( createToken(
                TokenType.KEYWORD ,
                value ,
                startOffset ,
                startLine ,
                startColumn
            ) ) ;
            return ;
        }

        if ( ecmascriptReservedWords.has( value ) )
        {
            throw new EdenSyntaxError(
                `Reserved word "${ value }" cannot be used as an identifier.` ,
                {
                    source: this.#source ,
                    offset: startOffset ,
                    line:   startLine ,
                    column: startColumn
                }
            ) ;
        }

        this.#tokens.push( createToken(
            TokenType.IDENTIFIER ,
            value ,
            startOffset ,
            startLine ,
            startColumn
        ) ) ;
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
