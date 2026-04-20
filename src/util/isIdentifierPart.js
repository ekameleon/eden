/**
 * @file `IdentifierPart` predicate per SPEC §2.7.
 */

const ID_CONTINUE = /\p{ID_Continue}/u ;

/**
 * Returns `true` if the given character may appear in an eden
 * identifier after its start. An `IdentifierPart` is either `$`, `_`,
 * or a character in the Unicode `ID_Continue` class (which already
 * includes every `ID_Start` character and most digits).
 *
 * The input should be a **single code point**, represented as a string
 * of length 1 or 2 (surrogate pair for code points outside the BMP).
 *
 * @param   {string} char
 * @returns {boolean}
 */
export default function isIdentifierPart( char )
{
    if ( char === "_" || char === "$" )
    {
        return true ;
    }
    return ID_CONTINUE.test( char ) ;
}
