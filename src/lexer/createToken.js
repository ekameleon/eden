/**
 * @file Factory for the token objects produced by the lexer.
 *
 * Tokens are plain literal objects — there is no `Token` class.
 * Keeping tokens as bare objects avoids class allocation overhead in
 * the hot lexer loop and matches the shape documented in
 * ARCHITECTURE.md §3.
 */

/**
 * @typedef {object} Token
 * @property {string} type   - One of the values of `TokenType`.
 * @property {string} value  - Raw lexeme as it appears in the source.
 * @property {number} offset - Zero-based offset of the first character.
 * @property {number} line   - One-based line number.
 * @property {number} column - One-based column number.
 */

/**
 * Creates a new `Token`. Intended for internal use by the lexer; the
 * public API is `tokenize()`.
 *
 * @param   {string} type   - One of the values of `TokenType`.
 * @param   {string} value  - Raw lexeme as it appears in the source.
 * @param   {number} offset - Zero-based offset of the first character.
 * @param   {number} line   - One-based line number.
 * @param   {number} column - One-based column number.
 * @returns {Token}
 */
export default function createToken( type , value , offset , line , column )
{
    return { type , value , offset , line , column } ;
}
