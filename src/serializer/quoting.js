/**
 * @file Quoting and escape helpers for the serializer.
 *
 * This module groups three sibling functions that each produce a
 * properly quoted form of a JavaScript string, one per output flavor:
 *
 *   - `quoteJSON`     — strict JSON, always double-quoted.
 *   - `quoteString`   — eden string literal, either quote style.
 *   - `quoteTemplate` — eden template literal (`` ` ``-quoted).
 *
 * The functions are kept as **named exports** because they form a
 * cohesive helper façade rather than a single primary symbol.
 *
 * The escape strategy follows the lexer's accepted forms documented
 * in SPEC.md §2.9 and §2.10, so that any output produced here is
 * round-trippable through `parse()` / `parseToAST()`.
 */

/**
 * Returns `code` formatted as a `\uXXXX` escape sequence (lowercase
 * hex, zero-padded to four digits).
 *
 * @param   {number} code - A UTF-16 code unit value (`0`…`0xFFFF`).
 * @returns {string}
 */
function unicodeEscape( code )
{
    return "\\u" + code.toString( 16 ).padStart( 4 , "0" ) ;
}

/**
 * Returns a strict JSON-encoded form of `value`, always wrapped in
 * double quotes. Suitable for `jsonCompatible` output.
 *
 * The escape table matches what modern `JSON.stringify` emits:
 *   - the short escapes `\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t` ;
 *   - any other `U+0000`…`U+001F` byte as `\uXXXX` ;
 *   - every other code unit, including `U+2028` and `U+2029`, passes
 *     through verbatim (matches `JSON.stringify` in modern engines).
 *
 * @param   {string} value
 * @returns {string}
 */
export function quoteJSON( value )
{
    const length = value.length ;
    let   result = "\"" ;

    for ( let index = 0 ; index < length ; index += 1 )
    {
        const ch   = value[ index ] ;
        const code = value.charCodeAt( index ) ;

        if ( ch === "\\" ) { result += "\\\\" ; continue ; }
        if ( ch === "\"" ) { result += "\\\"" ; continue ; }

        if ( code === 0x08 ) { result += "\\b" ; continue ; }
        if ( code === 0x09 ) { result += "\\t" ; continue ; }
        if ( code === 0x0A ) { result += "\\n" ; continue ; }
        if ( code === 0x0C ) { result += "\\f" ; continue ; }
        if ( code === 0x0D ) { result += "\\r" ; continue ; }

        if ( code < 0x20 )
        {
            result += unicodeEscape( code ) ;
            continue ;
        }

        result += ch ;
    }

    return result + "\"" ;
}

/**
 * Returns an eden string literal quoting `value`, using `quoteChar`
 * as the enclosing delimiter.
 *
 * Escapes applied:
 *   - `\\` and the active quote character;
 *   - the short escapes `\b`, `\t`, `\n`, `\v`, `\f`, `\r`;
 *   - `\0` for `U+0000` when not followed by a decimal digit (the
 *     ambiguous case falls back to `\x00`);
 *   - `U+2028` and `U+2029` as ` ` / ` `, to remain safe
 *     for consumers that pass the output to a pre-ES2019 `eval`;
 *   - any other `U+0001`…`U+001F` byte as `\uXXXX`.
 *
 * Every other code unit, including back-ticks and the opposite
 * quote character, passes through verbatim.
 *
 * @param   {string}        value
 * @param   {"\"" | "'"}    quoteChar
 * @returns {string}
 */
export function quoteString( value , quoteChar )
{
    const length = value.length ;
    let   result = quoteChar ;

    for ( let index = 0 ; index < length ; index += 1 )
    {
        const ch   = value[ index ] ;
        const code = value.charCodeAt( index ) ;

        if ( ch === "\\"      ) { result += "\\\\"           ; continue ; }
        if ( ch === quoteChar ) { result += "\\" + quoteChar ; continue ; }

        if ( code === 0x08 ) { result += "\\b" ; continue ; }
        if ( code === 0x09 ) { result += "\\t" ; continue ; }
        if ( code === 0x0A ) { result += "\\n" ; continue ; }
        if ( code === 0x0B ) { result += "\\v" ; continue ; }
        if ( code === 0x0C ) { result += "\\f" ; continue ; }
        if ( code === 0x0D ) { result += "\\r" ; continue ; }

        if ( code === 0x00 )
        {
            const nextCode = value.charCodeAt( index + 1 ) ;
            const isDigit  = nextCode >= 0x30 && nextCode <= 0x39 ;
            result += isDigit ? "\\x00" : "\\0" ;
            continue ;
        }

        if ( code === 0x2028 ) { result += "\\u2028" ; continue ; }
        if ( code === 0x2029 ) { result += "\\u2029" ; continue ; }

        if ( code < 0x20 )
        {
            result += unicodeEscape( code ) ;
            continue ;
        }

        result += ch ;
    }

    return result + quoteChar ;
}

/**
 * Returns an eden template literal quoting `value`, wrapped in
 * back-ticks. Line terminators are preserved verbatim, matching the
 * multi-line semantics documented in SPEC.md §2.10.
 *
 * Escapes applied:
 *   - `\\` and back-ticks;
 *   - the short escapes `\b`, `\t`, `\v`, `\f` (but not `\n` / `\r`,
 *     which a template carries verbatim);
 *   - `\0` for `U+0000` (with the same digit-ambiguity guard as
 *     `quoteString`);
 *   - any other `U+0001`…`U+001F` byte as `\uXXXX`.
 *
 * `${...}` sequences are **not** escaped: SPEC §2.10 treats them as
 * passthrough payload that downstream consumers may interpret with
 * their own rules.
 *
 * @param   {string} value
 * @returns {string}
 */
export function quoteTemplate( value )
{
    const length = value.length ;
    let   result = "`" ;

    for ( let index = 0 ; index < length ; index += 1 )
    {
        const ch   = value[ index ] ;
        const code = value.charCodeAt( index ) ;

        if ( ch === "\\" ) { result += "\\\\" ; continue ; }
        if ( ch === "`"  ) { result += "\\`"  ; continue ; }

        if ( code === 0x0A || code === 0x0D || code === 0x2028 || code === 0x2029 )
        {
            result += ch ;
            continue ;
        }

        if ( code === 0x08 ) { result += "\\b" ; continue ; }
        if ( code === 0x09 ) { result += "\\t" ; continue ; }
        if ( code === 0x0B ) { result += "\\v" ; continue ; }
        if ( code === 0x0C ) { result += "\\f" ; continue ; }

        if ( code === 0x00 )
        {
            const nextCode = value.charCodeAt( index + 1 ) ;
            const isDigit  = nextCode >= 0x30 && nextCode <= 0x39 ;
            result += isDigit ? "\\x00" : "\\0" ;
            continue ;
        }

        if ( code < 0x20 )
        {
            result += unicodeEscape( code ) ;
            continue ;
        }

        result += ch ;
    }

    return result + "`" ;
}
