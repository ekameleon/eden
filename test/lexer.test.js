/**
 * @file Unit tests for the lexer.
 *
 * This file grows with every lexer sub-step. Sub-step 1 covers
 * whitespace, line terminators, end-of-file and source positions.
 * Subsequent sub-steps append their own `describe(...)` blocks here
 * instead of creating new files.
 */

import { describe , test , expect } from "bun:test" ;

import {
    tokenize ,
    TokenType ,
    EdenError ,
    EdenSyntaxError
}
from "../src/index.js" ;

/**
 * Convenience helper: asserts a single EOF token at the given
 * position and returns the token itself for further inspection.
 *
 * @param   {import("../src/lexer/Token.js").Token[]} tokens
 * @returns {import("../src/lexer/Token.js").Token}
 */
function expectSingleEOF( tokens )
{
    expect( tokens ).toHaveLength( 1 ) ;
    expect( tokens[ 0 ].type ).toBe( TokenType.EOF ) ;
    return tokens[ 0 ] ;
}

describe( "lexer — empty source" , () =>
{
    test( "empty string emits a single EOF token at (1, 1, 0)" , () =>
    {
        const eof = expectSingleEOF( tokenize( "" ) ) ;
        expect( eof.value  ).toBe( "" ) ;
        expect( eof.offset ).toBe( 0 ) ;
        expect( eof.line   ).toBe( 1 ) ;
        expect( eof.column ).toBe( 1 ) ;
    } ) ;
} ) ;

describe( "lexer — whitespace" , () =>
{
    test.each(
    [
        [ "space"                   , " "        ] ,
        [ "tab"                     , "\t"       ] ,
        [ "vertical tab"            , "\v"       ] ,
        [ "form feed"               , "\f"       ] ,
        [ "no-break space (U+00A0)" , "\u00A0"   ] ,
        [ "byte order mark (U+FEFF)", "\uFEFF"   ] ,
        [ "em space (U+2003)"       , "\u2003"   ]
    ] )( "%s is skipped" , ( _label , source ) =>
    {
        const eof = expectSingleEOF( tokenize( source ) ) ;
        expect( eof.offset ).toBe( source.length ) ;
        expect( eof.line   ).toBe( 1 ) ;
        expect( eof.column ).toBe( 1 + source.length ) ;
    } ) ;

    test( "mixed whitespace updates column but not line" , () =>
    {
        const eof = expectSingleEOF( tokenize( " \t \f " ) ) ;
        expect( eof.line   ).toBe( 1 ) ;
        expect( eof.column ).toBe( 6 ) ;
        expect( eof.offset ).toBe( 5 ) ;
    } ) ;
} ) ;

describe( "lexer — line terminators" , () =>
{
    test.each(
    [
        [ "LF"  , "\n"     ] ,
        [ "CR"  , "\r"     ] ,
        [ "LS"  , "\u2028" ] ,
        [ "PS"  , "\u2029" ]
    ] )( "%s increments line and resets column" , ( _label , source ) =>
    {
        const eof = expectSingleEOF( tokenize( source ) ) ;
        expect( eof.line   ).toBe( 2 ) ;
        expect( eof.column ).toBe( 1 ) ;
        expect( eof.offset ).toBe( source.length ) ;
    } ) ;

    test( "CRLF is counted as a single line terminator" , () =>
    {
        const eof = expectSingleEOF( tokenize( "\r\n" ) ) ;
        expect( eof.line   ).toBe( 2 ) ;
        expect( eof.column ).toBe( 1 ) ;
        expect( eof.offset ).toBe( 2 ) ;
    } ) ;

    test( "multiple lines and spaces update positions accurately" , () =>
    {
        const eof = expectSingleEOF( tokenize( "  \n  \n  " ) ) ;
        expect( eof.line   ).toBe( 3 ) ;
        expect( eof.column ).toBe( 3 ) ;
        expect( eof.offset ).toBe( 8 ) ;
    } ) ;
} ) ;

describe( "lexer — unexpected character" , () =>
{
    test( "rejects a character not yet recognized with accurate location" , () =>
    {
        let caught = null ;
        try
        {
            tokenize( "  §" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught ).toBeInstanceOf( EdenError ) ;
        expect( caught.name ).toBe( "EdenSyntaxError" ) ;
        expect( caught.message ).toContain( "Unexpected character" ) ;
        expect( caught.offset ).toBe( 2 ) ;
        expect( caught.line   ).toBe( 1 ) ;
        expect( caught.column ).toBe( 3 ) ;
        expect( caught.source ).toBe( "  §" ) ;
    } ) ;

    test( "location after a CRLF points to the right column on the new line" , () =>
    {
        let caught = null ;
        try
        {
            tokenize( "\r\n §" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.offset ).toBe( 3 ) ;
        expect( caught.line   ).toBe( 2 ) ;
        expect( caught.column ).toBe( 2 ) ;
    } ) ;
} ) ;

describe( "lexer — TokenType enum" , () =>
{
    test( "is frozen and cannot be mutated" , () =>
    {
        expect( Object.isFrozen( TokenType ) ).toBe( true ) ;
        expect( () =>
        {
            "use strict" ;
            TokenType.EOF = "x" ;
        } ).toThrow() ;
    } ) ;

    test( "exposes the expected string values" , () =>
    {
        expect( TokenType.EOF           ).toBe( "EOF"           ) ;
        expect( TokenType.PUNCTUATOR    ).toBe( "Punctuator"    ) ;
        expect( TokenType.LINE_COMMENT  ).toBe( "LineComment"   ) ;
        expect( TokenType.BLOCK_COMMENT ).toBe( "BlockComment"  ) ;
        expect( TokenType.IDENTIFIER    ).toBe( "Identifier"    ) ;
        expect( TokenType.KEYWORD       ).toBe( "Keyword"       ) ;
        expect( TokenType.NUMBER        ).toBe( "Number"        ) ;
        expect( TokenType.BIGINT        ).toBe( "BigInt"        ) ;
        expect( TokenType.STRING        ).toBe( "String"        ) ;
        expect( TokenType.TEMPLATE      ).toBe( "Template"      ) ;
    } ) ;
} ) ;

describe( "lexer — API contract" , () =>
{
    test( "tokenize throws TypeError when source is not a string" , () =>
    {
        expect( () => tokenize( 42           ) ).toThrow( TypeError ) ;
        expect( () => tokenize( null         ) ).toThrow( TypeError ) ;
        expect( () => tokenize( undefined    ) ).toThrow( TypeError ) ;
        expect( () => tokenize( { a: 1 }     ) ).toThrow( TypeError ) ;
    } ) ;

    test( "tokenize ignores the options argument for now" , () =>
    {
        const eof = expectSingleEOF( tokenize( "" , { someUnknownOption: true } ) ) ;
        expect( eof.type ).toBe( TokenType.EOF ) ;
    } ) ;
} ) ;
