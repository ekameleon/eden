/**
 * @file Unit tests for the parser.
 *
 * This file grows with every parser sub-step. The first sub-step
 * covers the parser skeleton and the value keywords `null`, `true`,
 * `false`, `undefined`, `NaN`, `Infinity`. Subsequent sub-steps
 * append their own `describe(...)` blocks here instead of creating
 * new files.
 */

import { describe , test , expect } from "bun:test" ;

import {
    parseToAST ,
    NodeType ,
    LiteralKind ,
    ProgramMode ,
    EdenError ,
    EdenSyntaxError
}
from "../src/index.js" ;

/**
 * Convenience helper: unwraps the single data-mode value from a
 * parsed Program and returns it.
 *
 * @param   {ReturnType<typeof parseToAST>} program
 * @returns {object}
 */
function onlyValue( program )
{
    expect( program.type ).toBe( NodeType.PROGRAM ) ;
    expect( program.mode ).toBe( ProgramMode.DATA ) ;
    expect( program.body ).toHaveLength( 1 ) ;
    return program.body[ 0 ] ;
}

describe( "parser — value keywords" , () =>
{
    test.each(
    [
        [ "null"       , null                         , LiteralKind.NULL      ] ,
        [ "true"       , true                         , LiteralKind.BOOLEAN   ] ,
        [ "false"      , false                        , LiteralKind.BOOLEAN   ] ,
        [ "undefined"  , undefined                    , LiteralKind.UNDEFINED ] ,
        [ "NaN"        , Number.NaN                   , LiteralKind.NUMBER    ] ,
        [ "Infinity"   , Number.POSITIVE_INFINITY     , LiteralKind.NUMBER    ]
    ] )( "keyword %p parses to a Literal with the right value and kind" ,
         ( source , expectedValue , expectedKind ) =>
    {
        const program = parseToAST( source ) ;
        const literal = onlyValue( program ) ;

        expect( literal.type ).toBe( NodeType.LITERAL ) ;
        if ( Number.isNaN( expectedValue ) )
        {
            expect( Number.isNaN( literal.value ) ).toBe( true ) ;
        }
        else
        {
            expect( literal.value ).toBe( expectedValue ) ;
        }
        expect( literal.raw    ).toBe( source ) ;
        expect( literal.kind   ).toBe( expectedKind ) ;
        expect( literal.offset ).toBe( 0 ) ;
        expect( literal.line   ).toBe( 1 ) ;
        expect( literal.column ).toBe( 1 ) ;
    } ) ;

    test( "positions reflect the source offset after whitespace" , () =>
    {
        const program = parseToAST( "  \n  true" ) ;
        const literal = onlyValue( program ) ;

        expect( literal.value  ).toBe( true ) ;
        expect( literal.offset ).toBe( 5 ) ;
        expect( literal.line   ).toBe( 2 ) ;
        expect( literal.column ).toBe( 3 ) ;
    } ) ;

    test( "line comments are skipped silently" , () =>
    {
        const program = parseToAST( "// leading comment\nnull" ) ;
        const literal = onlyValue( program ) ;
        expect( literal.value ).toBe( null ) ;
        expect( literal.line  ).toBe( 2 ) ;
    } ) ;

    test( "block comments are skipped silently" , () =>
    {
        const program = parseToAST( "/* a\n   block */ false" ) ;
        const literal = onlyValue( program ) ;
        expect( literal.value ).toBe( false ) ;
        expect( literal.line  ).toBe( 2 ) ;
    } ) ;

    test( "trailing comments after the value are skipped" , () =>
    {
        const program = parseToAST( "true // trailing" ) ;
        const literal = onlyValue( program ) ;
        expect( literal.value ).toBe( true ) ;
    } ) ;
} ) ;

describe( "parser — error cases" , () =>
{
    test( "empty source throws \"Expected a value.\"" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught ).toBeInstanceOf( EdenError ) ;
        expect( caught.message.toLowerCase() ).toContain( "expected a value" ) ;
    } ) ;

    test( "whitespace-only source throws \"Expected a value.\"" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "   \n  \t " ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "expected a value" ) ;
    } ) ;

    test( "trailing tokens after the value are rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "null null" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "after value" ) ;
    } ) ;

    test( "non-value token at program start is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "]" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
    } ) ;

    test( "parseToAST throws TypeError when source is not a string" , () =>
    {
        expect( () => parseToAST( 42 ) ).toThrow( TypeError ) ;
        expect( () => parseToAST( null ) ).toThrow( TypeError ) ;
    } ) ;
} ) ;

describe( "parser — NodeType / LiteralKind / ProgramMode enums" , () =>
{
    test( "NodeType is frozen and exposes the expected values" , () =>
    {
        expect( Object.isFrozen( NodeType ) ).toBe( true ) ;
        expect( NodeType.PROGRAM     ).toBe( "Program"     ) ;
        expect( NodeType.LITERAL     ).toBe( "Literal"     ) ;
        expect( NodeType.IDENTIFIER  ).toBe( "Identifier"  ) ;
    } ) ;

    test( "LiteralKind is frozen and exposes the expected values" , () =>
    {
        expect( Object.isFrozen( LiteralKind ) ).toBe( true ) ;
        expect( LiteralKind.NULL     ).toBe( "null"     ) ;
        expect( LiteralKind.BOOLEAN  ).toBe( "boolean"  ) ;
        expect( LiteralKind.NUMBER   ).toBe( "number"   ) ;
    } ) ;

    test( "ProgramMode is frozen and exposes the expected values" , () =>
    {
        expect( Object.isFrozen( ProgramMode ) ).toBe( true ) ;
        expect( ProgramMode.DATA ).toBe( "data" ) ;
        expect( ProgramMode.EVAL ).toBe( "eval" ) ;
    } ) ;
} ) ;

describe( "parser — numeric literals" , () =>
{
    test.each(
    [
        [ "0"          , 0          ] ,
        [ "42"         , 42         ] ,
        [ "1000000"    , 1000000    ] ,
        [ "1_000"      , 1000       ] ,
        [ "1_000_000"  , 1000000    ] ,
        [ "1.5"        , 1.5        ] ,
        [ ".5"         , 0.5        ] ,
        [ "0.5"        , 0.5        ] ,
        [ "1e10"       , 1e10       ] ,
        [ "2.5e-3"     , 2.5e-3     ] ,
        [ "1E+0"       , 1          ] ,
        [ "0xFF"       , 0xFF       ] ,
        [ "0Xff"       , 0xff       ] ,
        [ "0xF_F"      , 0xFF       ] ,
        [ "0o17"       , 0o17       ] ,
        [ "0o1_7"      , 0o17       ] ,
        [ "0b101"      , 0b101      ] ,
        [ "0b1_0_1"    , 0b101      ] ,
        [ "1_000.5"    , 1000.5     ]
    ] )( "number %p resolves to %p" , ( source , expected ) =>
    {
        const program = parseToAST( source ) ;
        const literal = program.body[ 0 ] ;

        expect( literal.type  ).toBe( NodeType.LITERAL ) ;
        expect( literal.kind  ).toBe( LiteralKind.NUMBER ) ;
        expect( literal.value ).toBe( expected ) ;
        expect( literal.raw   ).toBe( source ) ;
    } ) ;
} ) ;

describe( "parser — BigInt literals" , () =>
{
    test.each(
    [
        [ "0n"        , 0n      ] ,
        [ "42n"       , 42n     ] ,
        [ "1_000n"    , 1000n   ] ,
        [ "0xFFn"     , 0xFFn   ] ,
        [ "0xF_Fn"    , 0xFFn   ] ,
        [ "0o17n"     , 0o17n   ] ,
        [ "0b101n"    , 0b101n  ]
    ] )( "BigInt %p resolves to %p" , ( source , expected ) =>
    {
        const program = parseToAST( source ) ;
        const literal = program.body[ 0 ] ;

        expect( literal.type  ).toBe( NodeType.LITERAL ) ;
        expect( literal.kind  ).toBe( LiteralKind.BIGINT ) ;
        expect( literal.value ).toBe( expected ) ;
        expect( literal.raw   ).toBe( source ) ;
    } ) ;

    test( "BigInt with very large hex value preserves precision" , () =>
    {
        const program = parseToAST( "0xFFFFFFFFFFFFFFFFn" ) ;
        expect( program.body[ 0 ].value ).toBe( 0xFFFFFFFFFFFFFFFFn ) ;
    } ) ;
} ) ;

describe( "parser — string literals" , () =>
{
    test.each(
    [
        [ "\"\""             , ""        ] ,
        [ "''"               , ""        ] ,
        [ "\"foo\""          , "foo"     ] ,
        [ "'foo'"            , "foo"     ] ,
        [ "\"it's fine\""    , "it's fine" ] ,
        [ "'say \"hi\"'"     , "say \"hi\"" ]
    ] )( "string %p resolves to %p" , ( source , expected ) =>
    {
        const program = parseToAST( source ) ;
        const literal = program.body[ 0 ] ;

        expect( literal.type  ).toBe( NodeType.LITERAL ) ;
        expect( literal.kind  ).toBe( LiteralKind.STRING ) ;
        expect( literal.value ).toBe( expected ) ;
        expect( literal.raw   ).toBe( source ) ;
    } ) ;

    test.each(
    [
        [ "\"\\n\""   , "\n" ] ,
        [ "\"\\t\""   , "\t" ] ,
        [ "\"\\r\""   , "\r" ] ,
        [ "\"\\b\""   , "\b" ] ,
        [ "\"\\f\""   , "\f" ] ,
        [ "\"\\v\""   , "\v" ] ,
        [ "\"\\0\""   , "\0" ] ,
        [ "\"\\\\\""  , "\\" ] ,
        [ "\"\\\"\""  , "\"" ] ,
        [ "'\\''"     , "'"  ]
    ] )( "escape %p resolves to its character" , ( source , expected ) =>
    {
        const program = parseToAST( source ) ;
        expect( program.body[ 0 ].value ).toBe( expected ) ;
    } ) ;

    test( "hex escape \\x41 resolves to \"A\"" , () =>
    {
        const program = parseToAST( "\"\\x41\"" ) ;
        expect( program.body[ 0 ].value ).toBe( "A" ) ;
    } ) ;

    test( "unicode 4-digit escape \\u0041 resolves to \"A\"" , () =>
    {
        const program = parseToAST( "\"\\u0041\"" ) ;
        expect( program.body[ 0 ].value ).toBe( "A" ) ;
    } ) ;

    test( "unicode braced escape resolves to the codepoint" , () =>
    {
        const program = parseToAST( "\"\\u{1F600}\"" ) ;
        expect( program.body[ 0 ].value ).toBe( "\u{1F600}" ) ;
    } ) ;

    test( "Unicode content is preserved verbatim" , () =>
    {
        const program = parseToAST( "\"café — 数据 🐱\"" ) ;
        expect( program.body[ 0 ].value ).toBe( "café — 数据 🐱" ) ;
    } ) ;

    test( "line continuation produces nothing" , () =>
    {
        const program = parseToAST( "\"abc\\\ndef\"" ) ;
        expect( program.body[ 0 ].value ).toBe( "abcdef" ) ;
    } ) ;

    test( "CRLF line continuation also produces nothing" , () =>
    {
        const program = parseToAST( "\"a\\\r\nb\"" ) ;
        expect( program.body[ 0 ].value ).toBe( "ab" ) ;
    } ) ;

    test( "mixed escapes in one string" , () =>
    {
        const program = parseToAST( "\"a\\nb\\tc\\u0041d\"" ) ;
        expect( program.body[ 0 ].value ).toBe( "a\nb\tcAd" ) ;
    } ) ;
} ) ;

describe( "parser — template literals" , () =>
{
    test( "empty template" , () =>
    {
        const program = parseToAST( "``" ) ;
        const literal = program.body[ 0 ] ;
        expect( literal.kind  ).toBe( LiteralKind.TEMPLATE ) ;
        expect( literal.value ).toBe( "" ) ;
    } ) ;

    test( "simple template" , () =>
    {
        const program = parseToAST( "`hello`" ) ;
        const literal = program.body[ 0 ] ;
        expect( literal.kind  ).toBe( LiteralKind.TEMPLATE ) ;
        expect( literal.value ).toBe( "hello" ) ;
    } ) ;

    test( "multi-line template preserves line terminators" , () =>
    {
        const program = parseToAST( "`line 1\nline 2\nline 3`" ) ;
        expect( program.body[ 0 ].value ).toBe( "line 1\nline 2\nline 3" ) ;
    } ) ;

    test( "template escapes resolve like string escapes" , () =>
    {
        const program = parseToAST( "`tab:\\t done`" ) ;
        expect( program.body[ 0 ].value ).toBe( "tab:\t done" ) ;
    } ) ;

    test( "template backtick escape \\` resolves to `" , () =>
    {
        const program = parseToAST( "`a\\`b`" ) ;
        expect( program.body[ 0 ].value ).toBe( "a`b" ) ;
    } ) ;

    test( "template ${name} is preserved verbatim (no interpolation)" , () =>
    {
        const program = parseToAST( "`Hello ${name}!`" ) ;
        expect( program.body[ 0 ].value ).toBe( "Hello ${name}!" ) ;
    } ) ;

    test( "template with realistic downstream placeholders" , () =>
    {
        const program = parseToAST( "`SELECT * FROM t WHERE id = ${id}`" ) ;
        expect( program.body[ 0 ].value ).toBe( "SELECT * FROM t WHERE id = ${id}" ) ;
    } ) ;
} ) ;

describe( "parser — arrays" , () =>
{
    test( "empty array" , () =>
    {
        const program = parseToAST( "[]" ) ;
        const array   = program.body[ 0 ] ;

        expect( array.type     ).toBe( NodeType.ARRAY_EXPRESSION ) ;
        expect( array.elements ).toEqual( [] ) ;
        expect( array.offset   ).toBe( 0 ) ;
        expect( array.line     ).toBe( 1 ) ;
        expect( array.column   ).toBe( 1 ) ;
    } ) ;

    test( "single-element array" , () =>
    {
        const program = parseToAST( "[42]" ) ;
        const array   = program.body[ 0 ] ;

        expect( array.type ).toBe( NodeType.ARRAY_EXPRESSION ) ;
        expect( array.elements ).toHaveLength( 1 ) ;
        expect( array.elements[ 0 ].type  ).toBe( NodeType.LITERAL ) ;
        expect( array.elements[ 0 ].value ).toBe( 42 ) ;
    } ) ;

    test( "multi-element array" , () =>
    {
        const program = parseToAST( "[1, 2, 3]" ) ;
        const values  = program.body[ 0 ].elements.map( ( e ) => e.value ) ;
        expect( values ).toEqual( [ 1 , 2 , 3 ] ) ;
    } ) ;

    test( "trailing comma is accepted" , () =>
    {
        const program = parseToAST( "[1, 2, 3,]" ) ;
        const values  = program.body[ 0 ].elements.map( ( e ) => e.value ) ;
        expect( values ).toEqual( [ 1 , 2 , 3 ] ) ;
    } ) ;

    test( "array of mixed types" , () =>
    {
        const program  = parseToAST( "[null, true, \"s\", 1, 1n, `t`]" ) ;
        const elements = program.body[ 0 ].elements ;

        expect( elements.map( ( e ) => e.kind ) ).toEqual(
        [
            LiteralKind.NULL ,
            LiteralKind.BOOLEAN ,
            LiteralKind.STRING ,
            LiteralKind.NUMBER ,
            LiteralKind.BIGINT ,
            LiteralKind.TEMPLATE
        ] ) ;
    } ) ;

    test( "nested arrays" , () =>
    {
        const program = parseToAST( "[[1, 2], [3, 4]]" ) ;
        const outer   = program.body[ 0 ] ;

        expect( outer.type ).toBe( NodeType.ARRAY_EXPRESSION ) ;
        expect( outer.elements ).toHaveLength( 2 ) ;
        for ( const inner of outer.elements )
        {
            expect( inner.type ).toBe( NodeType.ARRAY_EXPRESSION ) ;
            expect( inner.elements ).toHaveLength( 2 ) ;
        }
    } ) ;

    test( "multi-line array" , () =>
    {
        const program = parseToAST( "[\n  1,\n  2,\n  3\n]" ) ;
        const values  = program.body[ 0 ].elements.map( ( e ) => e.value ) ;
        expect( values ).toEqual( [ 1 , 2 , 3 ] ) ;
    } ) ;

    test( "comments between elements are skipped" , () =>
    {
        const program = parseToAST( "[1, /* mid */ 2, // trailing\n 3]" ) ;
        const values  = program.body[ 0 ].elements.map( ( e ) => e.value ) ;
        expect( values ).toEqual( [ 1 , 2 , 3 ] ) ;
    } ) ;

    test( "array position reflects the opening \"[\"" , () =>
    {
        const program = parseToAST( "  [1]" ) ;
        const array   = program.body[ 0 ] ;
        expect( array.offset ).toBe( 2 ) ;
        expect( array.line   ).toBe( 1 ) ;
        expect( array.column ).toBe( 3 ) ;
    } ) ;
} ) ;

describe( "parser — array error cases" , () =>
{
    test( "unterminated after opening \"[\" is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "[" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toMatch( /expected a value|unterminated array/ ) ;
    } ) ;

    test( "unterminated after element is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "[1" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "unterminated array" ) ;
    } ) ;

    test( "elision [,] is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "[,]" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "elisions are not supported" ) ;
    } ) ;

    test( "elision [1,,2] is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "[1,,2]" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "elisions are not supported" ) ;
    } ) ;

    test( "missing comma between elements is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "[1 2]" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "expected \",\" or \"]\"" ) ;
    } ) ;

    test( "unterminated after trailing comma is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "[1," ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
    } ) ;
} ) ;
