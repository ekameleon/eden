/**
 * @file Hand-written recursive-descent parser for the eden grammar.
 *
 * The parser consumes the token stream produced by the lexer and
 * emits an AST conforming to ARCHITECTURE.md §4. Comments
 * (`LINE_COMMENT`, `BLOCK_COMMENT`) are silently skipped via the
 * `#peek()` / `#consume()` helpers, which advance over trivia before
 * returning the next significant token.
 *
 * The parser is mode-aware: it produces a `Program { mode: "data" }`
 * for eden data sources (SPEC.md §3.1) and a `Program { mode: "eval" }`
 * for eden evaluation sources (SPEC.md §3.2-§3.3). This sub-step
 * recognizes only the value keywords `null`, `true`, `false`,
 * `undefined`, `NaN`, and `Infinity`; further constructs land in the
 * next sub-steps.
 */

import EdenSyntaxError  from "../errors/EdenSyntaxError.js" ;
import TokenType        from "../lexer/TokenType.js" ;
import createLiteral    from "./ast/createLiteral.js" ;
import createProgram    from "./ast/createProgram.js" ;
import LiteralKind      from "./ast/LiteralKind.js" ;
import ProgramMode      from "./ast/ProgramMode.js" ;

/**
 * Handwritten recursive-descent parser.
 *
 * The class is exposed within the package but is **not** part of the
 * public API — consumers should import `parseToAST()` instead.
 */
export default class Parser
{
    /**
     * @param {import("../lexer/createToken.js").Token[]} tokens
     * @param {string}                                    source   - Original source text, for error locations.
     * @param {object}                                   [options] - Reserved for future use.
     */
    constructor( tokens , source , options )
    {
        this.#tokens  = tokens ;
        this.#source  = source ;
        this.#options = options ?? {} ;
        this.#index   = 0 ;
    }

    /**
     * Runs the parser and returns the full `Program` AST.
     *
     * @returns {import("./ast/createProgram.js").Program}
     * @throws  {EdenSyntaxError}
     */
    parse()
    {
        const value = this.#parseValue() ;
        this.#expectEof() ;
        return createProgram( ProgramMode.DATA , [ value ] ) ;
    }

    /** @type {number} */ #index ;
    /** @type {object} */ #options ;
    /** @type {string} */ #source ;
    /** @type {import("../lexer/createToken.js").Token[]} */ #tokens ;

    /**
     * Returns the current token and advances past it, after skipping
     * any leading trivia (comments).
     *
     * @returns {import("../lexer/createToken.js").Token}
     */
    #consume()
    {
        this.#skipTrivia() ;
        const token = this.#tokens[ this.#index ] ;
        this.#index += 1 ;
        return token ;
    }

    /**
     * Asserts that the parser has consumed the entire significant
     * token stream. A trailing `EOF` is expected; anything else
     * raises `EdenSyntaxError`.
     */
    #expectEof()
    {
        this.#skipTrivia() ;
        const token = this.#tokens[ this.#index ] ;

        if ( token === undefined || token.type !== TokenType.EOF )
        {
            throw this.#syntaxError(
                `Unexpected token "${ token.value }" after value.` ,
                token
            ) ;
        }
    }

    /**
     * Builds a `Literal` AST node for the given value keyword token.
     *
     * @param   {import("../lexer/createToken.js").Token} token
     * @returns {import("./ast/createLiteral.js").Literal}
     */
    #parseLiteralKeyword( token )
    {
        switch ( token.value )
        {
            case "null" :
                return createLiteral( null , token.value , LiteralKind.NULL ,
                    token.offset , token.line , token.column ) ;

            case "true" :
                return createLiteral( true , token.value , LiteralKind.BOOLEAN ,
                    token.offset , token.line , token.column ) ;

            case "false" :
                return createLiteral( false , token.value , LiteralKind.BOOLEAN ,
                    token.offset , token.line , token.column ) ;

            case "undefined" :
                return createLiteral( undefined , token.value , LiteralKind.UNDEFINED ,
                    token.offset , token.line , token.column ) ;

            case "NaN" :
                return createLiteral( Number.NaN , token.value , LiteralKind.NUMBER ,
                    token.offset , token.line , token.column ) ;

            case "Infinity" :
                return createLiteral( Number.POSITIVE_INFINITY , token.value , LiteralKind.NUMBER ,
                    token.offset , token.line , token.column ) ;

            default :
                throw this.#syntaxError(
                    `Unexpected keyword "${ token.value }".` ,
                    token
                ) ;
        }
    }

    /**
     * Parses a single value at the current position and returns its
     * AST node. Dispatches on the next significant token type.
     *
     * @returns {object}
     */
    #parseValue()
    {
        const token = this.#peek() ;

        if ( token === undefined || token.type === TokenType.EOF )
        {
            throw this.#syntaxError( "Expected a value." , token ) ;
        }

        if ( token.type === TokenType.KEYWORD )
        {
            this.#consume() ;
            return this.#parseLiteralKeyword( token ) ;
        }

        throw this.#syntaxError(
            `Unexpected token "${ token.value }".` ,
            token
        ) ;
    }

    /**
     * Returns the current significant token without advancing, after
     * skipping any leading trivia (comments).
     *
     * @returns {import("../lexer/createToken.js").Token | undefined}
     */
    #peek()
    {
        this.#skipTrivia() ;
        return this.#tokens[ this.#index ] ;
    }

    /**
     * Advances `#index` past every `LINE_COMMENT` and `BLOCK_COMMENT`
     * token starting at the current position. Has no effect when the
     * current token is significant.
     */
    #skipTrivia()
    {
        while ( this.#index < this.#tokens.length )
        {
            const current = this.#tokens[ this.#index ] ;
            if ( current.type !== TokenType.LINE_COMMENT &&
                 current.type !== TokenType.BLOCK_COMMENT )
            {
                break ;
            }
            this.#index += 1 ;
        }
    }

    /**
     * Builds an `EdenSyntaxError` anchored at the given token (or at
     * the end of the source if the token is absent).
     *
     * @param   {string}                                            message
     * @param   {import("../lexer/createToken.js").Token|undefined} token
     * @returns {EdenSyntaxError}
     */
    #syntaxError( message , token )
    {
        return new EdenSyntaxError( message ,
        {
            source: this.#source ,
            offset: token?.offset ?? this.#source.length ,
            line:   token?.line   ?? 1 ,
            column: token?.column ?? 1
        } ) ;
    }
}
