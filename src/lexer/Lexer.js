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
 * Hand-written character-level lexer.
 *
 * The class is exposed within the package but is **not** part of the
 * public API — consumers should import `tokenize()` instead.
 */
export default class Lexer
{
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

            if ( char === "\"" || char === "'" )
            {
                this.#readString( char ) ;
                continue ;
            }

            if ( this.#isDecimalDigit( char ) )
            {
                this.#readNumber() ;
                continue ;
            }

            if ( char === "." && this.#isDecimalDigit( this.#source[ this.#offset + 1 ] ) )
            {
                this.#readNumber() ;
                continue ;
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

    /** @type {number} */ #column ;
    /** @type {number} */ #length ;
    /** @type {number} */ #line ;
    /** @type {number} */ #offset ;
    /** @type {string} */ #source ;
    /** @type {import("./createToken.js").Token[]} */ #tokens ;

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
     * Returns `true` if `char` is an ASCII binary digit 0 or 1.
     *
     * @param   {string} char
     * @returns {boolean}
     */
    #isBinaryDigit( char )
    {
        return char === "0" || char === "1" ;
    }

    /**
     * Returns `true` if `char` is an ASCII decimal digit 0–9.
     *
     * @param   {string} char
     * @returns {boolean}
     */
    #isDecimalDigit( char )
    {
        return char >= "0" && char <= "9" ;
    }

    /**
     * Returns `true` if `char` is an ASCII hexadecimal digit
     * 0–9, a–f, or A–F.
     *
     * @param   {string} char
     * @returns {boolean}
     */
    #isHexDigit( char )
    {
        return ( char >= "0" && char <= "9" ) ||
               ( char >= "a" && char <= "f" ) ||
               ( char >= "A" && char <= "F" ) ;
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
     * Returns `true` if `char` is an ASCII octal digit 0–7.
     *
     * @param   {string} char
     * @returns {boolean}
     */
    #isOctalDigit( char )
    {
        return char >= "0" && char <= "7" ;
    }

    /**
     * Returns `true` if `char` may start a punctuator token per
     * SPEC.md §2.5. The `"..."` token is handled in
     * `#readPunctuator()` via a two-character lookahead.
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
     * Reads a `/* ... *\/` block comment starting at the current
     * offset. Block comments do not nest (SPEC.md §2.4); the first
     * `*\/` encountered ends the comment. Embedded line terminators
     * (including CRLF) correctly update `#line` and `#column`. If
     * end-of-input is reached before the closing `*\/`, an
     * `EdenSyntaxError` is raised at the position of the opening
     * `/*`.
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
     * Reads a run of valid digits at the current offset, allowing
     * `_` separators strictly between digits. The caller must
     * ensure that `#offset` points at a valid digit before calling.
     *
     * Separator rules mirror ECMAScript 2022:
     *   - `_` may appear only between two valid digits;
     *   - `_` at the start, at the end, or doubled is rejected;
     *   - `_` adjacent to a prefix (`0x_`) or to `.` is caught
     *     naturally by the surrounding reader.
     *
     * @param {(ch: string) => boolean} isValidDigit
     * @throws {EdenSyntaxError}
     */
    #readDigits( isValidDigit )
    {
        this.#offset += 1 ;
        this.#column += 1 ;

        while ( this.#offset < this.#length )
        {
            const ch = this.#source[ this.#offset ] ;

            if ( ch === "_" )
            {
                const nextCh = this.#source[ this.#offset + 1 ] ;
                if ( nextCh === undefined || !isValidDigit( nextCh ) )
                {
                    throw new EdenSyntaxError(
                        "Numeric separator must appear between digits." ,
                        {
                            source: this.#source ,
                            offset: this.#offset ,
                            line:   this.#line ,
                            column: this.#column
                        }
                    ) ;
                }
                this.#offset += 1 ;
                this.#column += 1 ;
                continue ;
            }

            if ( isValidDigit( ch ) )
            {
                this.#offset += 1 ;
                this.#column += 1 ;
                continue ;
            }

            break ;
        }
    }

    /**
     * Validates and consumes a single `\...` escape sequence at the
     * current offset inside a string literal. The lexer only
     * validates the syntactic shape; the value interpretation is
     * performed later by the parser from the raw lexeme.
     *
     * Recognized shapes (SPEC.md §2.9):
     *   - single-character escapes `\'`, `\"`, `\\`, `\b`, `\f`,
     *     `\n`, `\r`, `\t`, `\v`, `\0` (only when not followed by
     *     a decimal digit)
     *   - hex escape `\xHH` (exactly two hex digits)
     *   - unicode 4-digit escape `\uHHHH`
     *   - unicode braced escape `\u{H…H}` (1..6 hex digits, value
     *     must not exceed U+10FFFF)
     *   - line continuation: `\` immediately followed by LF, CR,
     *     CRLF, LS, or PS — consumed and position counters updated
     *
     * Legacy octal escapes (e.g. `\12`) are rejected.
     *
     * @throws {EdenSyntaxError}
     */
    #readEscapeSequence()
    {
        const escOffset = this.#offset ;
        const escLine   = this.#line ;
        const escColumn = this.#column ;

        this.#offset += 1 ;
        this.#column += 1 ;

        if ( this.#offset >= this.#length )
        {
            throw new EdenSyntaxError(
                "Unterminated escape sequence." ,
                {
                    source: this.#source ,
                    offset: escOffset ,
                    line:   escLine ,
                    column: escColumn
                }
            ) ;
        }

        const next = this.#source[ this.#offset ] ;

        if ( this.#isLineTerminator( next ) )
        {
            this.#consumeLineTerminator( next ) ;
            return ;
        }

        switch ( next )
        {
            case "\"" :
            case "'"  :
            case "\\" :
            case "b"  :
            case "f"  :
            case "n"  :
            case "r"  :
            case "t"  :
            case "v"  :
                this.#offset += 1 ;
                this.#column += 1 ;
                return ;
        }

        if ( next === "0" )
        {
            const after = this.#source[ this.#offset + 1 ] ;
            if ( after !== undefined && this.#isDecimalDigit( after ) )
            {
                throw new EdenSyntaxError(
                    "Octal escape sequences are not allowed." ,
                    {
                        source: this.#source ,
                        offset: escOffset ,
                        line:   escLine ,
                        column: escColumn
                    }
                ) ;
            }
            this.#offset += 1 ;
            this.#column += 1 ;
            return ;
        }

        if ( next === "x" )
        {
            this.#offset += 1 ;
            this.#column += 1 ;
            for ( let i = 0 ; i < 2 ; i += 1 )
            {
                const ch = this.#source[ this.#offset ] ;
                if ( ch === undefined || !this.#isHexDigit( ch ) )
                {
                    throw new EdenSyntaxError(
                        "Invalid hex escape sequence." ,
                        {
                            source: this.#source ,
                            offset: escOffset ,
                            line:   escLine ,
                            column: escColumn
                        }
                    ) ;
                }
                this.#offset += 1 ;
                this.#column += 1 ;
            }
            return ;
        }

        if ( next === "u" )
        {
            this.#offset += 1 ;
            this.#column += 1 ;

            const afterU = this.#source[ this.#offset ] ;

            if ( afterU === "{" )
            {
                this.#offset += 1 ;
                this.#column += 1 ;

                let hexDigits = "" ;
                while ( this.#offset < this.#length )
                {
                    const ch = this.#source[ this.#offset ] ;

                    if ( ch === "}" )
                    {
                        break ;
                    }

                    if ( ch === "\"" || ch === "'" || this.#isLineTerminator( ch ) )
                    {
                        throw new EdenSyntaxError(
                            "Unterminated unicode escape sequence." ,
                            {
                                source: this.#source ,
                                offset: escOffset ,
                                line:   escLine ,
                                column: escColumn
                            }
                        ) ;
                    }

                    if ( !this.#isHexDigit( ch ) )
                    {
                        throw new EdenSyntaxError(
                            "Invalid unicode escape sequence." ,
                            {
                                source: this.#source ,
                                offset: escOffset ,
                                line:   escLine ,
                                column: escColumn
                            }
                        ) ;
                    }

                    hexDigits += ch ;
                    this.#offset += 1 ;
                    this.#column += 1 ;
                }

                if ( this.#source[ this.#offset ] !== "}" )
                {
                    throw new EdenSyntaxError(
                        "Unterminated unicode escape sequence." ,
                        {
                            source: this.#source ,
                            offset: escOffset ,
                            line:   escLine ,
                            column: escColumn
                        }
                    ) ;
                }

                if ( hexDigits.length === 0 )
                {
                    throw new EdenSyntaxError(
                        "Unicode escape sequence cannot be empty." ,
                        {
                            source: this.#source ,
                            offset: escOffset ,
                            line:   escLine ,
                            column: escColumn
                        }
                    ) ;
                }

                const codePoint = parseInt( hexDigits , 16 ) ;
                if ( codePoint > 0x10FFFF )
                {
                    throw new EdenSyntaxError(
                        "Unicode codepoint out of range." ,
                        {
                            source: this.#source ,
                            offset: escOffset ,
                            line:   escLine ,
                            column: escColumn
                        }
                    ) ;
                }

                this.#offset += 1 ;
                this.#column += 1 ;
                return ;
            }

            for ( let i = 0 ; i < 4 ; i += 1 )
            {
                const ch = this.#source[ this.#offset ] ;
                if ( ch === undefined || !this.#isHexDigit( ch ) )
                {
                    throw new EdenSyntaxError(
                        "Invalid unicode escape sequence." ,
                        {
                            source: this.#source ,
                            offset: escOffset ,
                            line:   escLine ,
                            column: escColumn
                        }
                    ) ;
                }
                this.#offset += 1 ;
                this.#column += 1 ;
            }
            return ;
        }

        throw new EdenSyntaxError(
            `Invalid escape sequence "\\${ next }".` ,
            {
                source: this.#source ,
                offset: escOffset ,
                line:   escLine ,
                column: escColumn
            }
        ) ;
    }

    /**
     * Reads an identifier-like lexeme starting at the current
     * offset, classifies it, and pushes the resulting token.
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
     * Reads a `//` line comment starting at the current offset. The
     * comment runs up to (but not including) the next line terminator
     * or end of input; the terminator itself is left for the main
     * loop to consume, so `#line` and `#column` are updated correctly.
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
     * Reads a numeric literal (decimal, hex, octal, binary, BigInt)
     * per SPEC.md §2.8. Signs (`+`/`-`) are **not** part of the
     * numeric literal itself; they are surfaced as separate
     * punctuator tokens and reconstructed as `UnaryExpression` by
     * the parser (SPEC.md §3.1).
     *
     * Rejects: legacy octals (`0777`), trailing `.` with no
     * fraction digits, BigInt with fraction/exponent, numeric
     * literals immediately followed by an `IdentifierPart` or by
     * another digit.
     *
     * @throws {EdenSyntaxError}
     */
    #readNumber()
    {
        const startOffset = this.#offset ;
        const startLine   = this.#line ;
        const startColumn = this.#column ;

        let hasDot           = false ;
        let hasExponent      = false ;
        let isNonDecimalBase = false ;

        const first = this.#source[ this.#offset ] ;

        if ( first === "." )
        {
            hasDot = true ;
            this.#offset += 1 ;
            this.#column += 1 ;
            this.#readDigits( ( ch ) => this.#isDecimalDigit( ch ) ) ;
        }
        else if ( first === "0" )
        {
            const next = this.#source[ this.#offset + 1 ] ;

            if ( next === "x" || next === "X" )
            {
                this.#offset += 2 ;
                this.#column += 2 ;
                if ( !this.#isHexDigit( this.#source[ this.#offset ] ?? "" ) )
                {
                    throw new EdenSyntaxError(
                        "Missing digits after \"0x\" prefix." ,
                        {
                            source: this.#source ,
                            offset: startOffset ,
                            line:   startLine ,
                            column: startColumn
                        }
                    ) ;
                }
                this.#readDigits( ( ch ) => this.#isHexDigit( ch ) ) ;
                isNonDecimalBase = true ;
            }
            else if ( next === "o" || next === "O" )
            {
                this.#offset += 2 ;
                this.#column += 2 ;
                if ( !this.#isOctalDigit( this.#source[ this.#offset ] ?? "" ) )
                {
                    throw new EdenSyntaxError(
                        "Missing digits after \"0o\" prefix." ,
                        {
                            source: this.#source ,
                            offset: startOffset ,
                            line:   startLine ,
                            column: startColumn
                        }
                    ) ;
                }
                this.#readDigits( ( ch ) => this.#isOctalDigit( ch ) ) ;
                isNonDecimalBase = true ;
            }
            else if ( next === "b" || next === "B" )
            {
                this.#offset += 2 ;
                this.#column += 2 ;
                if ( !this.#isBinaryDigit( this.#source[ this.#offset ] ?? "" ) )
                {
                    throw new EdenSyntaxError(
                        "Missing digits after \"0b\" prefix." ,
                        {
                            source: this.#source ,
                            offset: startOffset ,
                            line:   startLine ,
                            column: startColumn
                        }
                    ) ;
                }
                this.#readDigits( ( ch ) => this.#isBinaryDigit( ch ) ) ;
                isNonDecimalBase = true ;
            }
            else if ( next !== undefined && this.#isDecimalDigit( next ) )
            {
                throw new EdenSyntaxError(
                    "Legacy octal literals are not supported; use the \"0o\" prefix." ,
                    {
                        source: this.#source ,
                        offset: startOffset ,
                        line:   startLine ,
                        column: startColumn
                    }
                ) ;
            }
            else
            {
                this.#offset += 1 ;
                this.#column += 1 ;
            }
        }
        else
        {
            this.#readDigits( ( ch ) => this.#isDecimalDigit( ch ) ) ;
        }

        if ( !isNonDecimalBase && !hasDot && this.#source[ this.#offset ] === "." )
        {
            const after = this.#source[ this.#offset + 1 ] ;
            if ( after === undefined || !this.#isDecimalDigit( after ) )
            {
                throw new EdenSyntaxError(
                    "Decimal digits expected after \".\"." ,
                    {
                        source: this.#source ,
                        offset: this.#offset ,
                        line:   this.#line ,
                        column: this.#column
                    }
                ) ;
            }
            hasDot = true ;
            this.#offset += 1 ;
            this.#column += 1 ;
            this.#readDigits( ( ch ) => this.#isDecimalDigit( ch ) ) ;
        }

        if ( !isNonDecimalBase )
        {
            const ch = this.#source[ this.#offset ] ;
            if ( ch === "e" || ch === "E" )
            {
                const expOffset = this.#offset ;
                const expLine   = this.#line ;
                const expColumn = this.#column ;

                this.#offset += 1 ;
                this.#column += 1 ;

                const sign = this.#source[ this.#offset ] ;
                if ( sign === "+" || sign === "-" )
                {
                    this.#offset += 1 ;
                    this.#column += 1 ;
                }

                if ( !this.#isDecimalDigit( this.#source[ this.#offset ] ?? "" ) )
                {
                    throw new EdenSyntaxError(
                        "Decimal digits expected in exponent." ,
                        {
                            source: this.#source ,
                            offset: expOffset ,
                            line:   expLine ,
                            column: expColumn
                        }
                    ) ;
                }

                this.#readDigits( ( ch2 ) => this.#isDecimalDigit( ch2 ) ) ;
                hasExponent = true ;
            }
        }

        let isBigInt = false ;
        if ( this.#source[ this.#offset ] === "n" )
        {
            if ( hasDot )
            {
                throw new EdenSyntaxError(
                    "BigInt literals cannot have a fractional part." ,
                    {
                        source: this.#source ,
                        offset: startOffset ,
                        line:   startLine ,
                        column: startColumn
                    }
                ) ;
            }
            if ( hasExponent )
            {
                throw new EdenSyntaxError(
                    "BigInt literals cannot have an exponent." ,
                    {
                        source: this.#source ,
                        offset: startOffset ,
                        line:   startLine ,
                        column: startColumn
                    }
                ) ;
            }
            isBigInt = true ;
            this.#offset += 1 ;
            this.#column += 1 ;
        }

        if ( this.#offset < this.#length )
        {
            const cp       = this.#source.codePointAt( this.#offset ) ;
            const nextChar = String.fromCodePoint( cp ) ;

            if ( this.#isDecimalDigit( nextChar ) || isIdentifierStart( nextChar ) )
            {
                throw new EdenSyntaxError(
                    `Unexpected character "${ nextChar }" after numeric literal.` ,
                    {
                        source: this.#source ,
                        offset: this.#offset ,
                        line:   this.#line ,
                        column: this.#column
                    }
                ) ;
            }
        }

        const value = this.#source.slice( startOffset , this.#offset ) ;
        this.#tokens.push( createToken(
            isBigInt ? TokenType.BIGINT : TokenType.NUMBER ,
            value ,
            startOffset ,
            startLine ,
            startColumn
        ) ) ;
    }

    /**
     * Reads a single punctuator token starting at the current offset
     * and pushes it to the output stream. Handles the
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
     * Reads a string literal starting at the current offset and
     * pushes a `TokenType.STRING` token holding the **raw** lexeme
     * (including the enclosing quotes and the unresolved escape
     * sequences). Escape validation happens via
     * `#readEscapeSequence()`; value interpretation is the parser's
     * responsibility.
     *
     * Raises:
     *   - `EdenSyntaxError("Unterminated string literal.")` at the
     *     position of the opening quote on EOF before closure;
     *   - `EdenSyntaxError("String literals cannot contain line
     *     terminators.")` at the position of a bare line terminator
     *     inside the body (line continuations via `\LT` are handled
     *     by `#readEscapeSequence()`).
     *
     * @param {"\"" | "'"} quote - The opening quote character.
     */
    #readString( quote )
    {
        const startOffset = this.#offset ;
        const startLine   = this.#line ;
        const startColumn = this.#column ;

        this.#offset += 1 ;
        this.#column += 1 ;

        while ( this.#offset < this.#length )
        {
            const ch = this.#source[ this.#offset ] ;

            if ( ch === quote )
            {
                this.#offset += 1 ;
                this.#column += 1 ;

                const value = this.#source.slice( startOffset , this.#offset ) ;
                this.#tokens.push( createToken(
                    TokenType.STRING ,
                    value ,
                    startOffset ,
                    startLine ,
                    startColumn
                ) ) ;
                return ;
            }

            if ( this.#isLineTerminator( ch ) )
            {
                throw new EdenSyntaxError(
                    "String literals cannot contain line terminators." ,
                    {
                        source: this.#source ,
                        offset: this.#offset ,
                        line:   this.#line ,
                        column: this.#column
                    }
                ) ;
            }

            if ( ch === "\\" )
            {
                this.#readEscapeSequence() ;
                continue ;
            }

            this.#offset += 1 ;
            this.#column += 1 ;
        }

        throw new EdenSyntaxError(
            "Unterminated string literal." ,
            {
                source: this.#source ,
                offset: startOffset ,
                line:   startLine ,
                column: startColumn
            }
        ) ;
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
