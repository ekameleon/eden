/**
 * @file `toJSON()` — convenience wrapper that always serializes
 *       through the eden serializer with `jsonCompatible: true`.
 *
 * Provided as a discoverable counterpart to `fromJSON()`. The
 * runtime behavior is identical to:
 *
 *     stringify( value , { ...options , jsonCompatible: true } )
 *
 * The caller-supplied `jsonCompatible` is overridden so the output
 * is always strict JSON. Other options (`indent`, `sortKeys`,
 * `replacer`, `maxDepth`, `quotes`, …) are forwarded as-is, even
 * when their effect is silently neutralized by JSON-compat mode.
 */

import stringify from "../serializer/stringify.js" ;

/**
 * Serializes a JavaScript value to a strict JSON source string.
 *
 * @param   {*} value
 * @param   {import("../serializer/helpers/resolveStringifyOptions.js").StringifyOptions} [options]
 * @returns {string}
 * @throws  {import("../errors/EdenTypeError.js").default}
 *          When `value` (or a sub-value) cannot be represented in
 *          strict JSON — e.g. a `BigInt`.
 */
export default function toJSON( value , options )
{
    return stringify( value , { ...( options ?? {} ) , jsonCompatible: true } ) ;
}
