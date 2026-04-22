/**
 * @file Merges a user-supplied `ParseOptions` object with the
 *       library defaults documented in ARCHITECTURE.md §6.1.
 *
 * The returned object is a fresh plain object, never the input one,
 * so downstream code can freely store it without worrying about
 * mutation by the caller.
 */

/**
 * @typedef {"data" | "eval"} ParseMode
 *
 * @typedef {object} ParseOptions
 * @property {ParseMode} [mode="data"]
 * @property {boolean}   [allowComments=true]
 * @property {boolean}   [allowTrailingCommas=true]
 * @property {boolean}   [allowSingleQuotes=true]
 * @property {boolean}   [allowUnquotedKeys=true]
 * @property {boolean}   [allowTemplates=true]
 * @property {boolean}   [allowBigInt=true]
 * @property {boolean}   [allowEmptySource=true]
 * @property {boolean}   [strictMode=true]
 * @property {number}    [maxDepth=1024]
 * @property {number}    [maxStringLength=Infinity]
 */

const DEFAULTS = Object.freeze(
{
    mode                : "data"    ,
    allowComments       : true      ,
    allowTrailingCommas : true      ,
    allowSingleQuotes   : true      ,
    allowUnquotedKeys   : true      ,
    allowTemplates      : true      ,
    allowBigInt         : true      ,
    allowEmptySource    : true      ,
    strictMode          : true      ,
    maxDepth            : 1024      ,
    maxStringLength     : Infinity
} ) ;

/**
 * Returns a resolved `ParseOptions` object: every default field is
 * present, user-supplied values override defaults.
 *
 * Unknown keys in the user input are passed through so that future
 * options can be exercised in tests without bumping the helper.
 *
 * @param   {ParseOptions} [input]
 * @returns {ParseOptions}
 */
export default function resolveParseOptions( input )
{
    return { ...DEFAULTS , ...( input ?? {} ) } ;
}
