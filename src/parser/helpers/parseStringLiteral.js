/**
 * @file Converts a `STRING` or `TEMPLATE` token lexeme into a
 *       JavaScript `string` with all escape sequences resolved.
 *
 * The lexer has already validated the lexeme (SPEC.md §2.9 and
 * §2.10), so this helper can walk the body character by character
 * and apply each escape sequence without reporting errors.
 *
 * The same helper serves both string quotes (`"..."`, `'...'`) and
 * templates (`` `...` ``). The only lexical difference — line
 * terminators inside the body — is already handled by the lexer:
 *   - For string literals the lexer forbids bare line terminators;
 *     the body contains none.
 *   - For template literals the lexer preserves line terminators in
 *     the body verbatim; this helper copies them through.
 *
 * `${...}` sequences in templates are not escapes and are copied
 * character-by-character, preserving the passthrough semantics
 * documented in SPEC.md §2.10.
 */

/**
 * Resolves all escape sequences in a string or template lexeme and
 * returns the resulting JavaScript string.
 *
 * @param   {string} raw - Source lexeme including the enclosing quotes.
 * @returns {string}
 */
export default function parseStringLiteral( raw )
{
    const body   = raw.slice( 1 , -1 ) ;
    const length = body.length ;

    let result = "" ;
    let index  = 0 ;

    while ( index < length )
    {
        const char = body[ index ] ;

        if ( char !== "\\" )
        {
            result += char ;
            index  += 1 ;
            continue ;
        }

        index += 1 ;
        const next = body[ index ] ;

        if ( next === "\n" || next === "\u2028" || next === "\u2029" )
        {
            index += 1 ;
            continue ;
        }
        if ( next === "\r" )
        {
            index += 1 ;
            if ( body[ index ] === "\n" )
            {
                index += 1 ;
            }
            continue ;
        }

        switch ( next )
        {
            case "'"  : result += "'"  ; index += 1 ; continue ;
            case "\"" : result += "\"" ; index += 1 ; continue ;
            case "`"  : result += "`"  ; index += 1 ; continue ;
            case "\\" : result += "\\" ; index += 1 ; continue ;
            case "b"  : result += "\b" ; index += 1 ; continue ;
            case "f"  : result += "\f" ; index += 1 ; continue ;
            case "n"  : result += "\n" ; index += 1 ; continue ;
            case "r"  : result += "\r" ; index += 1 ; continue ;
            case "t"  : result += "\t" ; index += 1 ; continue ;
            case "v"  : result += "\v" ; index += 1 ; continue ;
            case "0"  : result += "\0" ; index += 1 ; continue ;
        }

        if ( next === "x" )
        {
            index += 1 ;
            const hex = body.slice( index , index + 2 ) ;
            result += String.fromCodePoint( parseInt( hex , 16 ) ) ;
            index += 2 ;
            continue ;
        }

        if ( next === "u" )
        {
            index += 1 ;

            if ( body[ index ] === "{" )
            {
                index += 1 ;
                const end = body.indexOf( "}" , index ) ;
                const hex = body.slice( index , end ) ;
                result += String.fromCodePoint( parseInt( hex , 16 ) ) ;
                index = end + 1 ;
                continue ;
            }

            const hex = body.slice( index , index + 4 ) ;
            result += String.fromCodePoint( parseInt( hex , 16 ) ) ;
            index += 4 ;
            continue ;
        }
    }

    return result ;
}
