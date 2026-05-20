/**
 * @file Public `stringify()` entry point — the JSON-compatible
 *       counterpart to `JSON.stringify`.
 *
 * Internally delegates to the `Serializer` class. This module exists
 * so that consumers and tests can import a single default-exported
 * function without instantiating the serializer themselves.
 */

import Serializer from "./Serializer.js" ;

/**
 * Serializes a JavaScript value as eden source.
 *
 * Sub-step 4.1 supports `null`, `undefined`, booleans, numbers
 * (including `NaN` and `±Infinity`) and BigInts. Other value types
 * raise `EdenTypeError` until their dedicated sub-step lands.
 *
 * @param   {*}                                                                  value
 * @param   {import("./helpers/resolveStringifyOptions.js").StringifyOptions} [options]
 * @returns {string}
 * @throws  {import("../errors/EdenTypeError.js").default}
 *          On non-serializable inputs (current scope limitation, or
 *          `BigInt` under `jsonCompatible`).
 */
export default function stringify( value , options )
{
    return new Serializer( options ).run( value ) ;
}
