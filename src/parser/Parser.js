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

import EdenSyntaxError        from "../errors/EdenSyntaxError.js" ;
import TokenType              from "../lexer/TokenType.js" ;
import createArrayExpression  from "./ast/createArrayExpression.js" ;
import createIdentifier       from "./ast/createIdentifier.js" ;
import createLiteral          from "./ast/createLiteral.js" ;
import createObjectExpression from "./ast/createObjectExpression.js" ;
import createProgram          from "./ast/createProgram.js" ;
import createProperty         from "./ast/createProperty.js" ;
import LiteralKind            from "./ast/LiteralKind.js" ;
import ProgramMode            from "./ast/ProgramMode.js" ;
import parseBigIntLiteral     from "./helpers/parseBigIntLiteral.js" ;
import parseNumericLiteral    from "./helpers/parseNumericLiteral.js" ;
import parseStringLiteral     from "./helpers/parseStringLiteral.js" ;

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
     * Parses an `[ ... ]` array expression starting at the current
     * offset. The opening `[` is expected to be the current token.
     *
     * Trailing commas are accepted (SPEC.md §3.4). Elisions such as
     * `[1, , 3]` are rejected with an explicit message.
     *
     * @returns {import("./ast/createArrayExpression.js").ArrayExpression}
     */
    #parseArray()
    {
        const open = this.#consume() ;

        const elements = [] ;

        let next = this.#peek() ;

        if ( next !== undefined && next.type === TokenType.PUNCTUATOR && next.value === "]" )
        {
            this.#consume() ;
            return createArrayExpression( elements , open.offset , open.line , open.column ) ;
        }

        while ( true )
        {
            next = this.#peek() ;

            if ( next === undefined || next.type === TokenType.EOF )
            {
                throw this.#syntaxError( "Unterminated array." , open ) ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === "," )
            {
                throw this.#syntaxError(
                    "Elisions are not supported in arrays. " +
                    "Use \"undefined\" or \"null\" explicitly." ,
                    next
                ) ;
            }

            elements.push( this.#parseValue() ) ;

            next = this.#peek() ;

            if ( next === undefined || next.type === TokenType.EOF )
            {
                throw this.#syntaxError( "Unterminated array." , open ) ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === "]" )
            {
                this.#consume() ;
                return createArrayExpression( elements , open.offset , open.line , open.column ) ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === "," )
            {
                this.#consume() ;

                const after = this.#peek() ;
                if ( after !== undefined &&
                     after.type === TokenType.PUNCTUATOR &&
                     after.value === "]" )
                {
                    this.#consume() ;
                    return createArrayExpression( elements , open.offset , open.line , open.column ) ;
                }
                continue ;
            }

            throw this.#syntaxError(
                "Expected \",\" or \"]\" after array element." ,
                next
            ) ;
        }
    }

    /**
     * Builds a `Literal` AST node from a `BIGINT` token.
     *
     * @param   {import("../lexer/createToken.js").Token} token
     * @returns {import("./ast/createLiteral.js").Literal}
     */
    #parseLiteralBigInt( token )
    {
        return createLiteral(
            parseBigIntLiteral( token.value ) ,
            token.value ,
            LiteralKind.BIGINT ,
            token.offset ,
            token.line ,
            token.column
        ) ;
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
     * Builds a `Literal` AST node from a `NUMBER` token.
     *
     * @param   {import("../lexer/createToken.js").Token} token
     * @returns {import("./ast/createLiteral.js").Literal}
     */
    #parseLiteralNumber( token )
    {
        return createLiteral(
            parseNumericLiteral( token.value ) ,
            token.value ,
            LiteralKind.NUMBER ,
            token.offset ,
            token.line ,
            token.column
        ) ;
    }

    /**
     * Builds a `Literal` AST node from a `STRING` token. The token
     * lexeme is handed to `parseStringLiteral` to resolve every
     * escape sequence into its final JavaScript string value.
     *
     * @param   {import("../lexer/createToken.js").Token} token
     * @returns {import("./ast/createLiteral.js").Literal}
     */
    #parseLiteralString( token )
    {
        return createLiteral(
            parseStringLiteral( token.value ) ,
            token.value ,
            LiteralKind.STRING ,
            token.offset ,
            token.line ,
            token.column
        ) ;
    }

    /**
     * Builds a `Literal` AST node from a `TEMPLATE` token. The same
     * escape-resolution helper is used as for strings; the `kind`
     * discriminator is what distinguishes the two at the AST level.
     *
     * @param   {import("../lexer/createToken.js").Token} token
     * @returns {import("./ast/createLiteral.js").Literal}
     */
    #parseLiteralTemplate( token )
    {
        return createLiteral(
            parseStringLiteral( token.value ) ,
            token.value ,
            LiteralKind.TEMPLATE ,
            token.offset ,
            token.line ,
            token.column
        ) ;
    }

    /**
     * Parses a `{ ... }` object expression starting at the current
     * offset. The opening `{` is expected to be the current token.
     *
     * Trailing commas are accepted (SPEC.md §3.5). In data mode,
     * shorthand properties (`{ foo }`) and computed keys
     * (`{ [expr]: v }`) are rejected with explicit messages.
     *
     * Duplicate keys are not deduplicated here: each property is
     * preserved in its source order, matching the ESTree convention.
     *
     * @returns {import("./ast/createObjectExpression.js").ObjectExpression}
     */
    #parseObject()
    {
        const open = this.#consume() ;

        const properties = [] ;

        let next = this.#peek() ;

        if ( next !== undefined && next.type === TokenType.PUNCTUATOR && next.value === "}" )
        {
            this.#consume() ;
            return createObjectExpression( properties , open.offset , open.line , open.column ) ;
        }

        while ( true )
        {
            next = this.#peek() ;

            if ( next === undefined || next.type === TokenType.EOF )
            {
                throw this.#syntaxError( "Unterminated object." , open ) ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === "[" )
            {
                throw this.#syntaxError(
                    "Computed property keys are not allowed in data mode." ,
                    next
                ) ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === "," )
            {
                throw this.#syntaxError(
                    "Expected a property key but found \",\"." ,
                    next
                ) ;
            }

            const keyStart = next ;
            const key      = this.#parsePropertyKey() ;

            const afterKey = this.#peek() ;

            if ( afterKey === undefined || afterKey.type === TokenType.EOF )
            {
                throw this.#syntaxError( "Unterminated object." , open ) ;
            }

            if ( afterKey.type !== TokenType.PUNCTUATOR || afterKey.value !== ":" )
            {
                if ( key.type === "Identifier" )
                {
                    throw this.#syntaxError(
                        "Shorthand properties are not allowed in data mode. " +
                        "Use the long form \"key: value\"." ,
                        keyStart
                    ) ;
                }
                throw this.#syntaxError(
                    "Expected \":\" after property key." ,
                    afterKey
                ) ;
            }

            this.#consume() ;

            const value = this.#parseValue() ;

            properties.push( createProperty(
                key ,
                value ,
                false ,
                false ,
                key.offset ,
                key.line ,
                key.column
            ) ) ;

            next = this.#peek() ;

            if ( next === undefined || next.type === TokenType.EOF )
            {
                throw this.#syntaxError( "Unterminated object." , open ) ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === "}" )
            {
                this.#consume() ;
                return createObjectExpression( properties , open.offset , open.line , open.column ) ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === "," )
            {
                this.#consume() ;

                const after = this.#peek() ;
                if ( after !== undefined &&
                     after.type === TokenType.PUNCTUATOR &&
                     after.value === "}" )
                {
                    this.#consume() ;
                    return createObjectExpression( properties , open.offset , open.line , open.column ) ;
                }
                continue ;
            }

            throw this.#syntaxError(
                "Expected \",\" or \"}\" after property value." ,
                next
            ) ;
        }
    }

    /**
     * Parses a single property key at the current position per
     * SPEC.md §3.5: an `Identifier`, a `StringLiteral`, or a
     * `NumericLiteral`. eden reserved keywords are rejected with
     * an explicit message advising to wrap them in quotes.
     *
     * @returns {import("./ast/createIdentifier.js").Identifier |
     *           import("./ast/createLiteral.js").Literal}
     */
    #parsePropertyKey()
    {
        const token = this.#peek() ;

        if ( token === undefined || token.type === TokenType.EOF )
        {
            throw this.#syntaxError( "Expected a property key." , token ) ;
        }

        if ( token.type === TokenType.IDENTIFIER )
        {
            this.#consume() ;
            return createIdentifier( token.value , token.offset , token.line , token.column ) ;
        }

        if ( token.type === TokenType.STRING )
        {
            this.#consume() ;
            return createLiteral(
                parseStringLiteral( token.value ) ,
                token.value ,
                LiteralKind.STRING ,
                token.offset , token.line , token.column
            ) ;
        }

        if ( token.type === TokenType.NUMBER )
        {
            this.#consume() ;
            return createLiteral(
                parseNumericLiteral( token.value ) ,
                token.value ,
                LiteralKind.NUMBER ,
                token.offset , token.line , token.column
            ) ;
        }

        if ( token.type === TokenType.KEYWORD )
        {
            throw this.#syntaxError(
                `Keyword "${ token.value }" cannot be used as a property key without quotes. ` +
                "Wrap it in double or single quotes." ,
                token
            ) ;
        }

        throw this.#syntaxError(
            "Expected a property key (identifier, string, or number)." ,
            token
        ) ;
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

        switch ( token.type )
        {
            case TokenType.KEYWORD  : return this.#parseLiteralKeyword(  this.#consume() ) ;
            case TokenType.NUMBER   : return this.#parseLiteralNumber(   this.#consume() ) ;
            case TokenType.BIGINT   : return this.#parseLiteralBigInt(   this.#consume() ) ;
            case TokenType.STRING   : return this.#parseLiteralString(   this.#consume() ) ;
            case TokenType.TEMPLATE : return this.#parseLiteralTemplate( this.#consume() ) ;
        }

        if ( token.type === TokenType.PUNCTUATOR && token.value === "[" )
        {
            return this.#parseArray() ;
        }

        if ( token.type === TokenType.PUNCTUATOR && token.value === "{" )
        {
            return this.#parseObject() ;
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
