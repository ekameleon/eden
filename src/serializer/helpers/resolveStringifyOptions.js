/**
 * @file Merges a user-supplied `StringifyOptions` object with the
 *       library defaults documented in ARCHITECTURE.md §6.2.
 *
 * The returned object is a fresh plain object, never the input one,
 * so downstream code can store it freely without worrying about
 * mutation by the caller.
 */

/**
 * @typedef {"double" | "single"} QuoteStyle
 *
 * @typedef {object} StringifyOptions
 * @property {number | string} [indent=0]
 *           Either a non-negative integer (number of spaces) or a
 *           literal indent string. `0` or `""` produces compact output.
 * @property {QuoteStyle}      [quotes="double"]
 *           Preferred quote character for `string`-kind literals.
 * @property {boolean}         [trailingCommas=false]
 *           Whether arrays and objects end with a trailing comma.
 * @property {boolean}         [unquotedKeys=true]
 *           When `true`, object keys that match the identifier grammar
 *           are emitted without quotes. eden default; forced to
 *           `false` by `jsonCompatible`.
 * @property {boolean}         [sortKeys=false]
 *           When `true`, object keys are emitted in sorted order.
 * @property {boolean}         [jsonCompatible=false]
 *           When `true`, the output is constrained to strict JSON:
 *           double-quoted keys, no templates, no `undefined`, no
 *           `BigInt`, no comments, no trailing commas.
 * @property {((key: string, value: *) => *) | null} [replacer=null]
 *           Optional `JSON.stringify`-style replacer function.
 * @property {number} [maxDepth=1024]
 *           Maximum nesting depth for composite values. Once
 *           exceeded, the serializer raises `EdenTypeError`
 *           rather than letting the call stack overflow.
 */

const DEFAULTS = Object.freeze(
{
    indent         : 0         ,
    quotes         : "double"  ,
    trailingCommas : false     ,
    unquotedKeys   : true      ,
    sortKeys       : false     ,
    jsonCompatible : false     ,
    replacer       : null      ,
    maxDepth       : 1024
} ) ;

/**
 * Returns a resolved `StringifyOptions` object: every default field is
 * present, user-supplied values override defaults.
 *
 * Unknown keys in the user input are passed through so that future
 * options can be exercised in tests without bumping the helper.
 *
 * @param   {StringifyOptions} [input]
 * @returns {StringifyOptions}
 */
export default function resolveStringifyOptions( input )
{
    return { ...DEFAULTS , ...( input ?? {} ) } ;
}
