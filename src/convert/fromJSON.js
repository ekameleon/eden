/**
 * @file `fromJSON()` — converts a JSON source string into an eden
 *       source string, applying the caller-supplied `StringifyOptions`.
 *
 * The implementation defers to the native `JSON.parse` (fast,
 * strict, well-tested) and then re-serializes through the eden
 * serializer with the requested formatting options. Malformed
 * JSON input raises `EdenSyntaxError` rather than the native
 * `SyntaxError`, so consumers can catch a single error type for
 * either library path; the original `SyntaxError` is preserved on
 * the `cause` chain.
 */

import EdenSyntaxError from "../errors/EdenSyntaxError.js" ;
import stringify       from "../serializer/stringify.js"   ;

/**
 * Converts a JSON source string into an eden source string.
 *
 * @param   {string} jsonSource
 * @param   {import("../serializer/helpers/resolveStringifyOptions.js").StringifyOptions} [options]
 * @returns {string}
 * @throws  {EdenSyntaxError} When `jsonSource` is not valid JSON.
 */
export default function fromJSON( jsonSource , options )
{
    let parsed ;
    try
    {
        parsed = JSON.parse( jsonSource ) ;
    }
    catch ( cause )
    {
        throw new EdenSyntaxError( "Invalid JSON source." , { cause } ) ;
    }
    return stringify( parsed , options ) ;
}
