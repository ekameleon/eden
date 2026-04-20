/**
 * @file Converts a `NUMBER` token lexeme into a JavaScript `Number`.
 *
 * The lexer has already validated the syntactic shape of the lexeme
 * (SPEC.md §2.8), so this helper only strips the numeric separators
 * `_` and delegates the actual parsing to the native `Number`
 * constructor, which handles decimals, exponents, and the `0x`,
 * `0o`, `0b` prefixes from ES2022 onwards.
 *
 * Special values such as `NaN` and `Infinity` are tokenized as
 * keywords, not as `NUMBER` tokens; they are handled elsewhere in
 * the parser.
 */

/**
 * Converts a numeric literal lexeme into a `Number`.
 *
 * @param   {string} raw - Numeric lexeme as emitted by the lexer.
 * @returns {number}
 */
export default function parseNumericLiteral( raw )
{
    return Number( raw.replace( /_/g , "" ) ) ;
}
