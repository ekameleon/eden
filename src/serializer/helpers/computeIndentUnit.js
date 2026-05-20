/**
 * @file Normalizes the `indent` option of `StringifyOptions` into
 *       the literal string used as one unit of indentation by the
 *       serializer.
 *
 * The behavior mirrors `JSON.stringify`:
 *   - a positive number becomes that many spaces, clamped to 10 ;
 *   - a non-empty string is used verbatim, truncated to 10 chars ;
 *   - anything else (zero, negative, empty string, `null`,
 *     `undefined`) yields an empty string, which signals "inline
 *     compact form" to the serializer.
 */

const MAX_INDENT = 10 ;

/**
 * Returns the indent unit string corresponding to the given option.
 *
 * @param   {number | string | null | undefined} indent
 * @returns {string}
 */
export default function computeIndentUnit( indent )
{
    if ( typeof indent === "number" && indent >= 1 )
    {
        return " ".repeat( Math.min( Math.floor( indent ) , MAX_INDENT ) ) ;
    }
    if ( typeof indent === "string" && indent.length > 0 )
    {
        return indent.slice( 0 , MAX_INDENT ) ;
    }
    return "" ;
}
