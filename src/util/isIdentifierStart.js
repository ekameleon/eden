/**
 * @file `IdentifierStart` predicate per SPEC §2.7.
 */

const ID_START = /\p{ID_Start}/u ;

/**
 * Returns `true` if the given character may start an eden identifier.
 * An `IdentifierStart` is either `$`, `_`, or a character in the
 * Unicode `ID_Start` class.
 *
 * The input should be a **single code point**, represented as a string
 * of length 1 or 2 (surrogate pair for code points outside the BMP).
 *
 * @param   {string} char
 * @returns {boolean}
 */
export default function isIdentifierStart( char )
{
    if ( char === "_" || char === "$" )
    {
        return true ;
    }
    return ID_START.test( char ) ;
}
