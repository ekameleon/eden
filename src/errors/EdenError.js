/**
 * @file Base class for every error raised by the eden library.
 *
 * Every eden error carries a `source` reference and `{ offset, line,
 * column }` triplet describing where in the source text the problem
 * was detected. These fields default to `null` when no source location
 * is available (e.g. an API-level misuse not tied to a specific
 * position). The public error hierarchy is documented in
 * ARCHITECTURE.md §7.
 */

/**
 * @typedef {object} EdenErrorLocation
 * @property {string|null} [source] - The source text the error refers to.
 * @property {number|null} [offset] - Zero-based offset of the first faulty character.
 * @property {number|null} [line]   - One-based line number of the first faulty character.
 * @property {number|null} [column] - One-based column number of the first faulty character.
 * @property {Error|null}  [cause]  - Underlying error that triggered this one, if any.
 */

/**
 * Base class for every error raised by the eden library.
 *
 * All eden-specific errors extend `EdenError`, which itself extends
 * the native `Error`. This lets consumers catch any eden failure with
 * a single `instanceof EdenError` check.
 */
export default class EdenError extends Error
{
    /**
     * @param {string}            message        - Human-readable description.
     * @param {EdenErrorLocation} [location]     - Optional source location information.
     */
    constructor( message , location )
    {
        super( message ) ;

        const {
            source = null ,
            offset = null ,
            line   = null ,
            column = null ,
            cause  = null
        } = location ?? {} ;

        this.name    = "EdenError" ;
        this.source  = source ;
        this.offset  = offset ;
        this.line    = line ;
        this.column  = column ;
        this.cause   = cause ;
    }
}
