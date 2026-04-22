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

import EdenSyntaxError           from "../errors/EdenSyntaxError.js" ;
import TokenType                 from "../lexer/TokenType.js" ;
import createArrayExpression     from "./ast/createArrayExpression.js" ;
import createAssignmentStatement from "./ast/createAssignmentStatement.js" ;
import createCallExpression      from "./ast/createCallExpression.js" ;
import createIdentifier          from "./ast/createIdentifier.js" ;
import createLiteral             from "./ast/createLiteral.js" ;
import createMemberExpression    from "./ast/createMemberExpression.js" ;
import createNewExpression       from "./ast/createNewExpression.js" ;
import createObjectExpression    from "./ast/createObjectExpression.js" ;
import createProgram             from "./ast/createProgram.js" ;
import createProperty            from "./ast/createProperty.js" ;
import createUnaryExpression     from "./ast/createUnaryExpression.js" ;
import LiteralKind            from "./ast/LiteralKind.js" ;
import NodeType               from "./ast/NodeType.js" ;
import ProgramMode            from "./ast/ProgramMode.js" ;
import parseBigIntLiteral     from "./helpers/parseBigIntLiteral.js" ;
import parseNumericLiteral    from "./helpers/parseNumericLiteral.js" ;
import parseStringLiteral     from "./helpers/parseStringLiteral.js" ;
import resolveParseOptions    from "./helpers/resolveParseOptions.js" ;

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
        this.#options = resolveParseOptions( options ) ;
        this.#index   = 0 ;
    }

    /**
     * Runs the parser and returns the full `Program` AST. The root
     * node's `mode` reflects the value of `options.mode`.
     *
     * In data mode the body contains exactly one value (SPEC.md §3.1).
     * In eval mode the body currently contains exactly one expression;
     * multi-statement programs are wired in a later sub-step.
     *
     * @returns {import("./ast/createProgram.js").Program}
     * @throws  {EdenSyntaxError}
     */
    parse()
    {
        if ( this.#options.mode === ProgramMode.EVAL )
        {
            return this.#parseEvalProgram() ;
        }

        const node = this.#parseValue() ;
        this.#expectEof() ;
        return createProgram( ProgramMode.DATA , [ node ] ) ;
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
     * Silently consumes a `";"` punctuator at the current position,
     * if any. Used to accept the optional statement terminator in
     * eval mode (SPEC.md §3.2).
     */
    #consumeOptionalSemicolon()
    {
        const next = this.#peek() ;
        if ( next !== undefined &&
             next.type === TokenType.PUNCTUATOR &&
             next.value === ";" )
        {
            this.#consume() ;
        }
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
     * Parses a `( expr, expr, )` argument list for a `CallExpression`
     * or `NewExpression`. The current token is expected to be `"("`.
     * Trailing comma is accepted iff `options.allowTrailingCommas`.
     *
     * @returns {Array<object>}
     */
    #parseArguments()
    {
        const open = this.#consume() ;

        const args = [] ;

        let next = this.#peek() ;

        if ( next !== undefined && next.type === TokenType.PUNCTUATOR && next.value === ")" )
        {
            this.#consume() ;
            return args ;
        }

        while ( true )
        {
            next = this.#peek() ;

            if ( next === undefined || next.type === TokenType.EOF )
            {
                throw this.#syntaxError( "Unterminated argument list." , open ) ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === "," )
            {
                throw this.#syntaxError(
                    "Expected an argument but found \",\"." ,
                    next
                ) ;
            }

            args.push( this.#parseValue() ) ;

            next = this.#peek() ;

            if ( next === undefined || next.type === TokenType.EOF )
            {
                throw this.#syntaxError( "Unterminated argument list." , open ) ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === ")" )
            {
                this.#consume() ;
                return args ;
            }

            if ( next.type === TokenType.PUNCTUATOR && next.value === "," )
            {
                const commaToken = this.#consume() ;

                const after = this.#peek() ;
                if ( after !== undefined &&
                     after.type === TokenType.PUNCTUATOR &&
                     after.value === ")" )
                {
                    if ( !this.#options.allowTrailingCommas )
                    {
                        throw this.#syntaxError(
                            "Trailing commas are not allowed." ,
                            commaToken
                        ) ;
                    }
                    this.#consume() ;
                    return args ;
                }
                continue ;
            }

            throw this.#syntaxError(
                "Expected \",\" or \")\" after argument." ,
                next
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
                const commaToken = this.#consume() ;

                const after = this.#peek() ;
                if ( after !== undefined &&
                     after.type === TokenType.PUNCTUATOR &&
                     after.value === "]" )
                {
                    if ( !this.#options.allowTrailingCommas )
                    {
                        throw this.#syntaxError(
                            "Trailing commas are not allowed." ,
                            commaToken
                        ) ;
                    }
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
     * Parses an eval-mode program: a sequence of statements until
     * end of input. Statements are separated by an optional `";"`;
     * no other separator is required (SPEC.md §3.2).
     *
     * @returns {import("./ast/createProgram.js").Program}
     */
    #parseEvalProgram()
    {
        const body = [] ;

        while ( true )
        {
            const next = this.#peek() ;
            if ( next === undefined || next.type === TokenType.EOF )
            {
                break ;
            }

            const indexBefore = this.#index ;
            body.push( this.#parseStatement() ) ;

            if ( this.#index <= indexBefore )
            {
                throw this.#syntaxError(
                    "Parser made no progress; aborting to avoid an infinite loop." ,
                    next
                ) ;
            }
        }

        return createProgram( ProgramMode.EVAL , body ) ;
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
     * Parses a `MemberPath` starting at the current offset (SPEC.md
     * §3.3). The current token is expected to be an `IDENTIFIER`.
     * The resulting node is either an `Identifier` (when there is
     * no member access) or a left-associative chain of
     * `MemberExpression` nodes.
     *
     * Bracket form `[ ... ]` only accepts a `StringLiteral` or a
     * `NumericLiteral` as property, per SPEC §3.3. Any other content
     * raises `EdenSyntaxError`.
     *
     * @returns {import("./ast/createIdentifier.js").Identifier |
     *           import("./ast/createMemberExpression.js").MemberExpression}
     */
    #parseMemberPath()
    {
        const first = this.#consume() ;

        let path = createIdentifier(
            first.value ,
            first.offset ,
            first.line ,
            first.column
        ) ;

        while ( true )
        {
            const next = this.#peek() ;
            if ( next === undefined || next.type !== TokenType.PUNCTUATOR )
            {
                break ;
            }

            if ( next.value === "." )
            {
                this.#consume() ;

                const idToken = this.#peek() ;
                if ( idToken === undefined || idToken.type !== TokenType.IDENTIFIER )
                {
                    throw this.#syntaxError(
                        "Expected an identifier after \".\"." ,
                        idToken
                    ) ;
                }
                this.#consume() ;

                const property = createIdentifier(
                    idToken.value ,
                    idToken.offset ,
                    idToken.line ,
                    idToken.column
                ) ;

                path = createMemberExpression(
                    path , property , false ,
                    path.offset , path.line , path.column
                ) ;
                continue ;
            }

            if ( next.value === "[" )
            {
                this.#consume() ;

                const keyToken = this.#peek() ;
                if ( keyToken === undefined )
                {
                    throw this.#syntaxError( "Unterminated bracket member access." , next ) ;
                }

                let property ;
                if ( keyToken.type === TokenType.STRING )
                {
                    this.#consume() ;
                    property = createLiteral(
                        parseStringLiteral( keyToken.value ) ,
                        keyToken.value ,
                        LiteralKind.STRING ,
                        keyToken.offset , keyToken.line , keyToken.column
                    ) ;
                }
                else if ( keyToken.type === TokenType.NUMBER )
                {
                    this.#consume() ;
                    property = createLiteral(
                        parseNumericLiteral( keyToken.value ) ,
                        keyToken.value ,
                        LiteralKind.NUMBER ,
                        keyToken.offset , keyToken.line , keyToken.column
                    ) ;
                }
                else
                {
                    throw this.#syntaxError(
                        "Bracket member access requires a string or number literal." ,
                        keyToken
                    ) ;
                }

                const close = this.#peek() ;
                if ( close === undefined ||
                     close.type !== TokenType.PUNCTUATOR ||
                     close.value !== "]" )
                {
                    throw this.#syntaxError(
                        "Expected \"]\" after bracket member access." ,
                        close
                    ) ;
                }
                this.#consume() ;

                path = createMemberExpression(
                    path , property , true ,
                    path.offset , path.line , path.column
                ) ;
                continue ;
            }

            break ;
        }

        return path ;
    }

    /**
     * Parses a `MemberPath` then, if immediately followed by `"("`,
     * wraps it in a `CallExpression`. After a call, any further
     * member access (`foo().bar`) or chained call (`foo()()`) is
     * rejected as SPEC §3.3 does not allow it.
     *
     * @returns {object}
     */
    #parseMemberPathOrCall()
    {
        const path = this.#parseMemberPath() ;

        const next = this.#peek() ;

        if ( next === undefined ||
             next.type !== TokenType.PUNCTUATOR ||
             next.value !== "(" )
        {
            return path ;
        }

        const args = this.#parseArguments() ;

        const call = createCallExpression(
            path , args ,
            path.offset , path.line , path.column
        ) ;

        const after = this.#peek() ;
        if ( after !== undefined && after.type === TokenType.PUNCTUATOR )
        {
            if ( after.value === "." || after.value === "[" )
            {
                throw this.#syntaxError(
                    "Chained member access after a call is not supported." ,
                    after
                ) ;
            }
            if ( after.value === "(" )
            {
                throw this.#syntaxError(
                    "Chained call is not supported." ,
                    after
                ) ;
            }
        }

        return call ;
    }

    /**
     * Parses a `NewExpression` starting at the current offset
     * (SPEC.md §3.3). The current token is expected to be the
     * `KEYWORD "new"`. Arguments are optional: `new Foo` is valid
     * and produces a `NewExpression` with an empty `arguments` array.
     *
     * @returns {import("./ast/createNewExpression.js").NewExpression}
     */
    #parseNewExpression()
    {
        const newToken = this.#consume() ;

        const idToken = this.#peek() ;
        if ( idToken === undefined || idToken.type !== TokenType.IDENTIFIER )
        {
            throw this.#syntaxError(
                "Expected an identifier after \"new\"." ,
                idToken
            ) ;
        }

        const callee = this.#parseMemberPath() ;

        let args = [] ;
        const after = this.#peek() ;
        if ( after !== undefined &&
             after.type === TokenType.PUNCTUATOR &&
             after.value === "(" )
        {
            args = this.#parseArguments() ;
        }

        return createNewExpression(
            callee , args ,
            newToken.offset , newToken.line , newToken.column
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

            const isEval = this.#options.mode === ProgramMode.EVAL ;

            if ( next.type === TokenType.PUNCTUATOR && next.value === "[" )
            {
                if ( !isEval )
                {
                    throw this.#syntaxError(
                        "Computed property keys are not allowed in data mode." ,
                        next
                    ) ;
                }

                const openBracket = this.#consume() ;
                const computedKey = this.#parseValue() ;

                const closeBracket = this.#peek() ;
                if ( closeBracket === undefined ||
                     closeBracket.type !== TokenType.PUNCTUATOR ||
                     closeBracket.value !== "]" )
                {
                    throw this.#syntaxError(
                        "Expected \"]\" after computed property key." ,
                        closeBracket
                    ) ;
                }
                this.#consume() ;

                const colonToken = this.#peek() ;
                if ( colonToken === undefined ||
                     colonToken.type !== TokenType.PUNCTUATOR ||
                     colonToken.value !== ":" )
                {
                    throw this.#syntaxError(
                        "Expected \":\" after computed property key." ,
                        colonToken
                    ) ;
                }
                this.#consume() ;

                const computedValue = this.#parseValue() ;

                properties.push( createProperty(
                    computedKey ,
                    computedValue ,
                    false ,
                    true ,
                    openBracket.offset ,
                    openBracket.line ,
                    openBracket.column
                ) ) ;
            }
            else
            {
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
                    if ( key.type === NodeType.IDENTIFIER && isEval )
                    {
                        const shorthandValue = createIdentifier(
                            key.name ,
                            key.offset ,
                            key.line ,
                            key.column
                        ) ;
                        properties.push( createProperty(
                            key ,
                            shorthandValue ,
                            true ,
                            false ,
                            key.offset ,
                            key.line ,
                            key.column
                        ) ) ;
                    }
                    else
                    {
                        if ( key.type === NodeType.IDENTIFIER )
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
                }
                else
                {
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
                }
            }

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
                const commaToken = this.#consume() ;

                const after = this.#peek() ;
                if ( after !== undefined &&
                     after.type === TokenType.PUNCTUATOR &&
                     after.value === "}" )
                {
                    if ( !this.#options.allowTrailingCommas )
                    {
                        throw this.#syntaxError(
                            "Trailing commas are not allowed." ,
                            commaToken
                        ) ;
                    }
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
     * Parses a single eval-mode `Statement` (SPEC.md §3.2). A
     * statement is either:
     *   - an `Assignment`, of the form `MemberPath "=" Expression`;
     *   - an `Expression`.
     *
     * A trailing `";"` is consumed silently when present. Assignment
     * targets are restricted to `Identifier` and `MemberExpression`
     * nodes; any other expression is rejected.
     *
     * @returns {object}
     */
    #parseStatement()
    {
        const expr = this.#parseValue() ;

        const next = this.#peek() ;

        if ( next !== undefined &&
             next.type === TokenType.PUNCTUATOR &&
             next.value === "=" )
        {
            if ( expr.type !== NodeType.IDENTIFIER &&
                 expr.type !== NodeType.MEMBER_EXPRESSION )
            {
                throw this.#syntaxError( "Invalid assignment target." , next ) ;
            }

            this.#consume() ;

            const value = this.#parseValue() ;

            const statement = createAssignmentStatement(
                expr ,
                value ,
                expr.offset ,
                expr.line ,
                expr.column
            ) ;

            this.#consumeOptionalSemicolon() ;
            return statement ;
        }

        this.#consumeOptionalSemicolon() ;
        return expr ;
    }

    /**
     * Parses a unary expression starting at the current offset. The
     * current token is expected to be `"+"` or `"-"`.
     *
     * In data mode (SPEC.md §3.1 `UnaryValue`), the argument must be
     * a `Number`, `BigInt`, or one of the numeric keywords `Infinity`
     * / `NaN`.
     *
     * In eval mode (SPEC.md §3.3 `UnaryExpression`), the argument can
     * be any expression.
     *
     * @returns {import("./ast/createUnaryExpression.js").UnaryExpression}
     */
    #parseUnary()
    {
        const signToken = this.#consume() ;
        const operator  = signToken.value ;

        if ( this.#options.mode === ProgramMode.EVAL )
        {
            const argument = this.#parseValue() ;
            return createUnaryExpression(
                operator ,
                argument ,
                signToken.offset ,
                signToken.line ,
                signToken.column
            ) ;
        }

        const next = this.#peek() ;

        let argument ;

        if ( next !== undefined )
        {
            if ( next.type === TokenType.NUMBER )
            {
                argument = this.#parseLiteralNumber( this.#consume() ) ;
            }
            else if ( next.type === TokenType.BIGINT )
            {
                argument = this.#parseLiteralBigInt( this.#consume() ) ;
            }
            else if ( next.type === TokenType.KEYWORD &&
                      ( next.value === "Infinity" || next.value === "NaN" ) )
            {
                argument = this.#parseLiteralKeyword( this.#consume() ) ;
            }
        }

        if ( argument === undefined )
        {
            throw this.#syntaxError(
                `Unary operator "${ operator }" expects a Number, BigInt, Infinity or NaN.` ,
                next
            ) ;
        }

        return createUnaryExpression(
            operator ,
            argument ,
            signToken.offset ,
            signToken.line ,
            signToken.column
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

        if ( this.#options.mode === ProgramMode.EVAL )
        {
            if ( token.type === TokenType.KEYWORD && token.value === "new" )
            {
                return this.#parseNewExpression() ;
            }

            if ( token.type === TokenType.IDENTIFIER )
            {
                return this.#parseMemberPathOrCall() ;
            }
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

        if ( token.type === TokenType.PUNCTUATOR &&
             ( token.value === "+" || token.value === "-" ) )
        {
            return this.#parseUnary() ;
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
     * current token is significant. When `options.allowComments` is
     * `false`, the first comment encountered raises
     * `EdenSyntaxError`.
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
            if ( !this.#options.allowComments )
            {
                throw this.#syntaxError( "Comments are not allowed." , current ) ;
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
