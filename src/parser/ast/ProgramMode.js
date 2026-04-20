/**
 * @file Enumeration of `Program.mode` values.
 *
 * eden recognizes two parsing modes (SPEC.md §1):
 *   - `DATA` — safe data-only surface consumed by `eden.parse`.
 *   - `EVAL` — full expression surface consumed by `eden.evaluate`.
 */

/**
 * Enumeration of every accepted value for `Program.mode`.
 *
 * @type {Readonly<{
 *     DATA: "data",
 *     EVAL: "eval"
 * }>}
 */
const ProgramMode = Object.freeze(
{
    DATA: "data" ,
    EVAL: "eval"
} ) ;

export default ProgramMode ;
