/**
 * @file Predicate telling whether a property name can be emitted as
 *       an unquoted identifier key per SPEC §3.5.
 *
 * The check combines two constraints:
 *   1. the string must satisfy the identifier grammar (SPEC §2.7);
 *   2. the string must not collide with a reserved word — eden value
 *      keywords, eden operation keywords, or any ECMAScript reserved
 *      word kept off-limits by the lexer for forward compatibility.
 *
 * This is the runtime symmetric of the lexer's identifier check,
 * intentionally re-using the same predicate modules and keyword sets
 * so that any key the serializer leaves unquoted is guaranteed to be
 * accepted by the parser on the way back.
 */

import ecmascriptReservedWords from "../../lexer/keywords/ecmascriptReservedWords.js" ;
import edenOperationKeywords   from "../../lexer/keywords/edenOperationKeywords.js" ;
import edenValueKeywords       from "../../lexer/keywords/edenValueKeywords.js" ;
import isIdentifierPart        from "../../util/isIdentifierPart.js" ;
import isIdentifierStart       from "../../util/isIdentifierStart.js" ;

/**
 * Returns `true` if `name` can appear as an unquoted property key in
 * eden source.
 *
 * @param   {string} name
 * @returns {boolean}
 */
export default function canBeUnquotedKey( name )
{
    if ( typeof name !== "string" || name.length === 0 )
    {
        return false ;
    }

    let first = true ;

    for ( const ch of name )
    {
        if ( first )
        {
            if ( ! isIdentifierStart( ch ) )
            {
                return false ;
            }
            first = false ;
            continue ;
        }
        if ( ! isIdentifierPart( ch ) )
        {
            return false ;
        }
    }

    if ( edenValueKeywords.has( name )       ) { return false ; }
    if ( edenOperationKeywords.has( name )   ) { return false ; }
    if ( ecmascriptReservedWords.has( name ) ) { return false ; }

    return true ;
}
