/**
 * @file Converts a `BIGINT` token lexeme into a JavaScript `BigInt`.
 *
 * The lexer has already validated the syntactic shape of the lexeme
 * (SPEC.md §2.8), so this helper strips the trailing `n` suffix and
 * the numeric separators `_`, then delegates parsing to the native
 * `BigInt` constructor, which accepts the `0x`, `0o`, `0b` prefixes
 * from ES2022 onwards.
 */

/**
 * Converts a BigInt literal lexeme into a `BigInt`.
 *
 * @param   {string} raw - BigInt lexeme as emitted by the lexer, e.g. `"42n"`.
 * @returns {bigint}
 */
export default function parseBigIntLiteral( raw )
{
    const body = raw.slice( 0 , -1 ).replace( /_/g , "" ) ;
    return BigInt( body ) ;
}
