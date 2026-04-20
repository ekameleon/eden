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
 * @param   {import("../src/lexer/createToken.js").Token[]} tokens
 * @returns {import("../src/lexer/createToken.js").Token}
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

describe( "lexer — punctuators" , () =>
{
    test.each(
    [
        "{" , "}" ,
        "[" , "]" ,
        "(" , ")" ,
        "," , ":" , ";" ,
        "." , "=" ,
        "+" , "-"
    ] )( "single-character punctuator %p" , ( source ) =>
    {
        const tokens = tokenize( source ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ] ).toEqual(
        {
            type:   TokenType.PUNCTUATOR ,
            value:  source ,
            offset: 0 ,
            line:   1 ,
            column: 1
        } ) ;
        expect( tokens[ 1 ].type ).toBe( TokenType.EOF ) ;
    } ) ;

    test( "\"...\" is lexed as a single token" , () =>
    {
        const tokens = tokenize( "..." ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ] ).toEqual(
        {
            type:   TokenType.PUNCTUATOR ,
            value:  "..." ,
            offset: 0 ,
            line:   1 ,
            column: 1
        } ) ;
        expect( tokens[ 1 ].offset ).toBe( 3 ) ;
        expect( tokens[ 1 ].column ).toBe( 4 ) ;
    } ) ;

    test( "\"..\" is lexed as two separate \".\" tokens" , () =>
    {
        const tokens = tokenize( ".." ) ;
        expect( tokens ).toHaveLength( 3 ) ;
        expect( tokens[ 0 ].value  ).toBe( "." ) ;
        expect( tokens[ 0 ].column ).toBe( 1 ) ;
        expect( tokens[ 1 ].value  ).toBe( "." ) ;
        expect( tokens[ 1 ].column ).toBe( 2 ) ;
        expect( tokens[ 2 ].type   ).toBe( TokenType.EOF ) ;
    } ) ;

    test( "multiple punctuators with whitespace preserve positions" , () =>
    {
        const tokens = tokenize( "{ } [ ]" ) ;
        expect( tokens.map( ( t ) => t.value ) ).toEqual(
            [ "{" , "}" , "[" , "]" , "" ]
        ) ;
        expect( tokens.map( ( t ) => t.column ) ).toEqual(
            [ 1 , 3 , 5 , 7 , 8 ]
        ) ;
    } ) ;

    test( "stray \"/\" raises EdenSyntaxError at its position" , () =>
    {
        let caught = null ;
        try
        {
            tokenize( " / " ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.offset ).toBe( 1 ) ;
        expect( caught.line   ).toBe( 1 ) ;
        expect( caught.column ).toBe( 2 ) ;
    } ) ;
} ) ;

describe( "lexer — line comments" , () =>
{
    test( "empty \"//\" at end of input" , () =>
    {
        const tokens = tokenize( "//" ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ] ).toEqual(
        {
            type:   TokenType.LINE_COMMENT ,
            value:  "//" ,
            offset: 0 ,
            line:   1 ,
            column: 1
        } ) ;
        expect( tokens[ 1 ].type   ).toBe( TokenType.EOF ) ;
        expect( tokens[ 1 ].column ).toBe( 3 ) ;
    } ) ;

    test( "\"// foo\" with no trailing terminator" , () =>
    {
        const tokens = tokenize( "// foo" ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ].value  ).toBe( "// foo" ) ;
        expect( tokens[ 0 ].type   ).toBe( TokenType.LINE_COMMENT ) ;
        expect( tokens[ 1 ].offset ).toBe( 6 ) ;
        expect( tokens[ 1 ].column ).toBe( 7 ) ;
    } ) ;

    test( "\"// foo\\n\" leaves the LF for the main loop" , () =>
    {
        const tokens = tokenize( "// foo\n" ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ].value  ).toBe( "// foo" ) ;
        expect( tokens[ 1 ].type   ).toBe( TokenType.EOF ) ;
        expect( tokens[ 1 ].line   ).toBe( 2 ) ;
        expect( tokens[ 1 ].column ).toBe( 1 ) ;
    } ) ;

    test( "two consecutive line comments" , () =>
    {
        const tokens = tokenize( "// line1\n// line2" ) ;
        expect( tokens ).toHaveLength( 3 ) ;
        expect( tokens[ 0 ].value  ).toBe( "// line1" ) ;
        expect( tokens[ 0 ].line   ).toBe( 1 ) ;
        expect( tokens[ 0 ].column ).toBe( 1 ) ;
        expect( tokens[ 1 ].value  ).toBe( "// line2" ) ;
        expect( tokens[ 1 ].line   ).toBe( 2 ) ;
        expect( tokens[ 1 ].column ).toBe( 1 ) ;
        expect( tokens[ 2 ].type   ).toBe( TokenType.EOF ) ;
    } ) ;

    test( "line comment stops at CR (CRLF-safe)" , () =>
    {
        const tokens = tokenize( "// foo\r\n" ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ].value  ).toBe( "// foo" ) ;
        expect( tokens[ 1 ].line   ).toBe( 2 ) ;
        expect( tokens[ 1 ].column ).toBe( 1 ) ;
    } ) ;
} ) ;

describe( "lexer — block comments" , () =>
{
    test( "empty block comment" , () =>
    {
        const tokens = tokenize( "/**/" ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ] ).toEqual(
        {
            type:   TokenType.BLOCK_COMMENT ,
            value:  "/**/" ,
            offset: 0 ,
            line:   1 ,
            column: 1
        } ) ;
        expect( tokens[ 1 ].column ).toBe( 5 ) ;
    } ) ;

    test( "single-line block comment with text" , () =>
    {
        const tokens = tokenize( "/* foo */" ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ].value  ).toBe( "/* foo */" ) ;
        expect( tokens[ 0 ].type   ).toBe( TokenType.BLOCK_COMMENT ) ;
        expect( tokens[ 1 ].column ).toBe( 10 ) ;
    } ) ;

    test( "multi-line block comment updates line and column correctly" , () =>
    {
        const source = "/* a\n b */" ;
        const tokens = tokenize( source ) ;
        expect( tokens[ 0 ].value  ).toBe( source ) ;
        expect( tokens[ 0 ].line   ).toBe( 1 ) ;
        expect( tokens[ 0 ].column ).toBe( 1 ) ;
        expect( tokens[ 1 ].type   ).toBe( TokenType.EOF ) ;
        expect( tokens[ 1 ].line   ).toBe( 2 ) ;
        expect( tokens[ 1 ].column ).toBe( 6 ) ;
        expect( tokens[ 1 ].offset ).toBe( source.length ) ;
    } ) ;

    test( "CRLF inside a block comment counts as a single line terminator" , () =>
    {
        const source = "/* a\r\n b */" ;
        const tokens = tokenize( source ) ;
        expect( tokens[ 0 ].value ).toBe( source ) ;
        expect( tokens[ 1 ].line  ).toBe( 2 ) ;
        expect( tokens[ 1 ].column ).toBe( 6 ) ;
    } ) ;

    test( "block comments do not nest: first \"*/\" closes it" , () =>
    {
        const tokens = tokenize( "/* /* */" ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ].value  ).toBe( "/* /* */" ) ;
        expect( tokens[ 0 ].type   ).toBe( TokenType.BLOCK_COMMENT ) ;
        expect( tokens[ 1 ].type   ).toBe( TokenType.EOF ) ;
    } ) ;

    test( "unterminated block comment points to the opening \"/*\"" , () =>
    {
        let caught = null ;
        try
        {
            tokenize( "  /* never ends" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "unterminated block comment" ) ;
        expect( caught.offset ).toBe( 2 ) ;
        expect( caught.line   ).toBe( 1 ) ;
        expect( caught.column ).toBe( 3 ) ;
    } ) ;
} ) ;

describe( "lexer — identifiers" , () =>
{
    test.each(
    [
        "foo" ,
        "_foo" ,
        "$bar" ,
        "foo123" ,
        "_" ,
        "$" ,
        "Foo_bar$baz" ,
        "a1b2c3"
    ] )( "ASCII identifier %p" , ( source ) =>
    {
        const tokens = tokenize( source ) ;
        expect( tokens ).toHaveLength( 2 ) ;
        expect( tokens[ 0 ] ).toEqual(
        {
            type:   TokenType.IDENTIFIER ,
            value:  source ,
            offset: 0 ,
            line:   1 ,
            column: 1
        } ) ;
        expect( tokens[ 1 ].type   ).toBe( TokenType.EOF ) ;
        expect( tokens[ 1 ].offset ).toBe( source.length ) ;
        expect( tokens[ 1 ].column ).toBe( 1 + source.length ) ;
    } ) ;

    test( "BMP Unicode identifier (café)" , () =>
    {
        const tokens = tokenize( "café" ) ;
        expect( tokens[ 0 ].type   ).toBe( TokenType.IDENTIFIER ) ;
        expect( tokens[ 0 ].value  ).toBe( "café" ) ;
        expect( tokens[ 1 ].offset ).toBe( 4 ) ;
        expect( tokens[ 1 ].column ).toBe( 5 ) ;
    } ) ;

    test( "CJK identifier (数据)" , () =>
    {
        const tokens = tokenize( "数据" ) ;
        expect( tokens[ 0 ].type   ).toBe( TokenType.IDENTIFIER ) ;
        expect( tokens[ 0 ].value  ).toBe( "数据" ) ;
        expect( tokens[ 1 ].offset ).toBe( 2 ) ;
    } ) ;

    test( "astral identifier (𝓍𝓎) outside the BMP" , () =>
    {
        const source = "𝓍𝓎" ;
        const tokens = tokenize( source ) ;
        expect( tokens[ 0 ].type   ).toBe( TokenType.IDENTIFIER ) ;
        expect( tokens[ 0 ].value  ).toBe( source ) ;
        expect( tokens[ 1 ].offset ).toBe( source.length ) ;
    } ) ;

    test( "two identifiers separated by whitespace" , () =>
    {
        const tokens = tokenize( "foo bar" ) ;
        expect( tokens ).toHaveLength( 3 ) ;
        expect( tokens[ 0 ].value  ).toBe( "foo" ) ;
        expect( tokens[ 0 ].column ).toBe( 1 ) ;
        expect( tokens[ 1 ].value  ).toBe( "bar" ) ;
        expect( tokens[ 1 ].column ).toBe( 5 ) ;
    } ) ;

    test( "identifier followed by a punctuator with no whitespace" , () =>
    {
        const tokens = tokenize( "foo.bar" ) ;
        expect( tokens.map( ( t ) => t.type ) ).toEqual(
        [
            TokenType.IDENTIFIER ,
            TokenType.PUNCTUATOR ,
            TokenType.IDENTIFIER ,
            TokenType.EOF
        ] ) ;
        expect( tokens.map( ( t ) => t.value ) ).toEqual(
            [ "foo" , "." , "bar" , "" ]
        ) ;
        expect( tokens.map( ( t ) => t.column ) ).toEqual(
            [ 1 , 4 , 5 , 8 ]
        ) ;
    } ) ;
} ) ;

describe( "lexer — eden keywords" , () =>
{
    test.each(
    [
        "null"      ,
        "true"      ,
        "false"     ,
        "undefined" ,
        "NaN"       ,
        "Infinity"
    ] )( "value keyword %p" , ( source ) =>
    {
        const tokens = tokenize( source ) ;
        expect( tokens[ 0 ] ).toEqual(
        {
            type:   TokenType.KEYWORD ,
            value:  source ,
            offset: 0 ,
            line:   1 ,
            column: 1
        } ) ;
        expect( tokens[ 1 ].type ).toBe( TokenType.EOF ) ;
    } ) ;

    test( "operation keyword \"new\"" , () =>
    {
        const tokens = tokenize( "new" ) ;
        expect( tokens[ 0 ] ).toEqual(
        {
            type:   TokenType.KEYWORD ,
            value:  "new" ,
            offset: 0 ,
            line:   1 ,
            column: 1
        } ) ;
    } ) ;

    test( "identifiers that contain a keyword as a substring remain identifiers" , () =>
    {
        for ( const source of [ "newValue" , "classroom" , "trueish" , "undefinedLike" ] )
        {
            const tokens = tokenize( source ) ;
            expect( tokens[ 0 ].type  ).toBe( TokenType.IDENTIFIER ) ;
            expect( tokens[ 0 ].value ).toBe( source ) ;
        }
    } ) ;
} ) ;

describe( "lexer — ECMAScript reserved words" , () =>
{
    test.each(
    [
        "class"     , "function" , "return"   , "var"       ,
        "let"       , "const"    , "yield"    , "await"     ,
        "async"     , "import"   , "export"   , "if"        ,
        "else"      , "for"      , "while"    , "do"        ,
        "switch"    , "case"     , "break"    , "continue"  ,
        "this"      , "super"    , "typeof"   , "instanceof",
        "delete"    , "void"     , "throw"    , "try"       ,
        "catch"     , "finally"  , "with"     , "debugger"  ,
        "default"   , "in"       , "extends"  , "static"    ,
        "enum"      , "implements", "interface", "package"  ,
        "private"   , "protected", "public"
    ] )( "reserved word %p is rejected at its start position" , ( source ) =>
    {
        let caught = null ;
        try
        {
            tokenize( source ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "reserved word" ) ;
        expect( caught.message ).toContain( `"${ source }"` ) ;
        expect( caught.offset ).toBe( 0 ) ;
        expect( caught.line   ).toBe( 1 ) ;
        expect( caught.column ).toBe( 1 ) ;
    } ) ;

    test( "reserved word preceded by whitespace reports the correct position" , () =>
    {
        let caught = null ;
        try
        {
            tokenize( "\n  class" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.offset ).toBe( 3 ) ;
        expect( caught.line   ).toBe( 2 ) ;
        expect( caught.column ).toBe( 3 ) ;
    } ) ;
} ) ;
