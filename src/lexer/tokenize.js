/**
 * @file Public tokenize() entry point.
 */

import Lexer from "./Lexer.js" ;

/**
 * Tokenizes an eden source string into a flat token stream.
 *
 * The lexer is **total**: it recognizes every lexical construct of
 * SPEC.md §2, regardless of mode (data/eval) or user-facing options.
 * Feature filtering (`allowComments`, `allowTemplates`,
 * `allowBigInt`, ...) is a Parser-level concern.
 *
 * The returned array always ends with a single `EOF` token, so
 * downstream parsers can rely on a non-empty result.
 *
 * @param   {string}  source    - The eden source text.
 * @param   {object}  [options] - Reserved for future use; currently ignored.
 * @returns {import("./createToken.js").Token[]}
 * @throws  {import("../errors/EdenSyntaxError.js").default} If the input is not a valid eden source.
 * @throws  {TypeError} If `source` is not a string.
 */
export default function tokenize( source , options )
{
    void options ;
    return new Lexer( source ).run() ;
}
