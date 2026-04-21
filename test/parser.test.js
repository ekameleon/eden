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

describe( "parser — objects" , () =>
{
    test( "empty object" , () =>
    {
        const program = parseToAST( "{}" ) ;
        const object  = program.body[ 0 ] ;

        expect( object.type       ).toBe( NodeType.OBJECT_EXPRESSION ) ;
        expect( object.properties ).toEqual( [] ) ;
        expect( object.offset     ).toBe( 0 ) ;
        expect( object.line       ).toBe( 1 ) ;
        expect( object.column     ).toBe( 1 ) ;
    } ) ;

    test( "single property with identifier key" , () =>
    {
        const program  = parseToAST( "{ name: \"Marc\" }" ) ;
        const object   = program.body[ 0 ] ;
        const property = object.properties[ 0 ] ;

        expect( object.properties ).toHaveLength( 1 ) ;
        expect( property.type      ).toBe( NodeType.PROPERTY ) ;
        expect( property.shorthand ).toBe( false ) ;
        expect( property.computed  ).toBe( false ) ;
        expect( property.key.type  ).toBe( NodeType.IDENTIFIER ) ;
        expect( property.key.name  ).toBe( "name" ) ;
        expect( property.value.type  ).toBe( NodeType.LITERAL ) ;
        expect( property.value.value ).toBe( "Marc" ) ;
    } ) ;

    test( "multiple properties" , () =>
    {
        const program  = parseToAST( "{ a: 1, b: 2, c: 3 }" ) ;
        const names    = program.body[ 0 ].properties.map( ( p ) => p.key.name ) ;
        const values   = program.body[ 0 ].properties.map( ( p ) => p.value.value ) ;
        expect( names  ).toEqual( [ "a" , "b" , "c" ] ) ;
        expect( values ).toEqual( [ 1 , 2 , 3 ] ) ;
    } ) ;

    test( "trailing comma is accepted" , () =>
    {
        const program = parseToAST( "{ a: 1, b: 2, }" ) ;
        expect( program.body[ 0 ].properties ).toHaveLength( 2 ) ;
    } ) ;

    test.each(
    [
        [ "{ foo: 1 }"    , NodeType.IDENTIFIER , "foo" ] ,
        [ "{ \"bar\": 1 }", NodeType.LITERAL    , "bar" ] ,
        [ "{ 'baz': 1 }"  , NodeType.LITERAL    , "baz" ] ,
        [ "{ 42: true }"  , NodeType.LITERAL    , 42    ] ,
        [ "{ 0xFF: 1 }"   , NodeType.LITERAL    , 255   ]
    ] )( "property key %p has the expected type and value" ,
         ( source , expectedKeyType , expectedKeyValue ) =>
    {
        const program = parseToAST( source ) ;
        const key     = program.body[ 0 ].properties[ 0 ].key ;

        expect( key.type ).toBe( expectedKeyType ) ;
        if ( expectedKeyType === NodeType.IDENTIFIER )
        {
            expect( key.name ).toBe( expectedKeyValue ) ;
        }
        else
        {
            expect( key.value ).toBe( expectedKeyValue ) ;
        }
    } ) ;

    test( "nested objects" , () =>
    {
        const program = parseToAST( "{ outer: { inner: 1 } }" ) ;
        const outer   = program.body[ 0 ] ;
        const inner   = outer.properties[ 0 ].value ;

        expect( outer.type ).toBe( NodeType.OBJECT_EXPRESSION ) ;
        expect( inner.type ).toBe( NodeType.OBJECT_EXPRESSION ) ;
        expect( inner.properties[ 0 ].key.name    ).toBe( "inner" ) ;
        expect( inner.properties[ 0 ].value.value ).toBe( 1 ) ;
    } ) ;

    test( "object with mixed value types including an array" , () =>
    {
        const program  = parseToAST( "{ tags: [\"a\", \"b\"], count: 2 }" ) ;
        const props    = program.body[ 0 ].properties ;

        expect( props[ 0 ].key.name  ).toBe( "tags" ) ;
        expect( props[ 0 ].value.type ).toBe( NodeType.ARRAY_EXPRESSION ) ;
        expect( props[ 0 ].value.elements ).toHaveLength( 2 ) ;
        expect( props[ 1 ].key.name  ).toBe( "count" ) ;
        expect( props[ 1 ].value.value ).toBe( 2 ) ;
    } ) ;

    test( "duplicate keys are preserved in order (AST level)" , () =>
    {
        const program = parseToAST( "{ a: 1, a: 2 }" ) ;
        const props   = program.body[ 0 ].properties ;
        expect( props ).toHaveLength( 2 ) ;
        expect( props[ 0 ].value.value ).toBe( 1 ) ;
        expect( props[ 1 ].value.value ).toBe( 2 ) ;
    } ) ;

    test( "unicode identifier as property key" , () =>
    {
        const program = parseToAST( "{ café: 1 }" ) ;
        const key     = program.body[ 0 ].properties[ 0 ].key ;
        expect( key.type ).toBe( NodeType.IDENTIFIER ) ;
        expect( key.name ).toBe( "café" ) ;
    } ) ;

    test( "comments between properties are skipped" , () =>
    {
        const program = parseToAST( "{ a: 1, // comment\n  b: 2 /* inline */ }" ) ;
        const props   = program.body[ 0 ].properties ;
        expect( props ).toHaveLength( 2 ) ;
        expect( props[ 0 ].key.name ).toBe( "a" ) ;
        expect( props[ 1 ].key.name ).toBe( "b" ) ;
    } ) ;

    test( "object position reflects the opening \"{\"" , () =>
    {
        const program = parseToAST( "  { x: 1 }" ) ;
        const object  = program.body[ 0 ] ;
        expect( object.offset ).toBe( 2 ) ;
        expect( object.line   ).toBe( 1 ) ;
        expect( object.column ).toBe( 3 ) ;
    } ) ;
} ) ;

describe( "parser — object error cases" , () =>
{
    test( "unterminated after opening \"{\" is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toMatch( /expected a property key|unterminated object/ ) ;
    } ) ;

    test( "shorthand property is rejected in data mode" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ a }" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "shorthand" ) ;
    } ) ;

    test( "missing value after \":\" is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ a: }" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
    } ) ;

    test( "unterminated after value is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ a: 1" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "unterminated object" ) ;
    } ) ;

    test( "leading comma is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ , }" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "expected a property key" ) ;
    } ) ;

    test( "double comma is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ a: 1,, b: 2 }" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
    } ) ;

    test( "keyword as property key is rejected with a hint" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ null: 1 }" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "cannot be used as a property key" ) ;
    } ) ;

    test( "computed property key is rejected in data mode" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ [x]: 1 }" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "computed property keys are not allowed" ) ;
    } ) ;

    test( "missing colon between key and value is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ a 1 }" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
    } ) ;

    test( "string-key shorthand attempt is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ \"a\" }" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }
        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "expected \":\"" ) ;
    } ) ;
} ) ;

describe( "parser — unary values" , () =>
{
    test.each(
    [
        [ "-1"       , "-" , 1      , LiteralKind.NUMBER ] ,
        [ "+1"       , "+" , 1      , LiteralKind.NUMBER ] ,
        [ "-1.5"     , "-" , 1.5    , LiteralKind.NUMBER ] ,
        [ "+0xFF"    , "+" , 255    , LiteralKind.NUMBER ] ,
        [ "-.5"      , "-" , 0.5    , LiteralKind.NUMBER ] ,
        [ "-0o17"    , "-" , 15     , LiteralKind.NUMBER ] ,
        [ "-0b101"   , "-" , 5      , LiteralKind.NUMBER ] ,
        [ "-1e10"    , "-" , 1e10   , LiteralKind.NUMBER ]
    ] )( "unary number %p -> operator %p, argument value %p" ,
         ( source , operator , expectedValue , expectedKind ) =>
    {
        const program = parseToAST( source ) ;
        const unary   = program.body[ 0 ] ;

        expect( unary.type     ).toBe( NodeType.UNARY_EXPRESSION ) ;
        expect( unary.operator ).toBe( operator ) ;
        expect( unary.argument.type  ).toBe( NodeType.LITERAL ) ;
        expect( unary.argument.value ).toBe( expectedValue ) ;
        expect( unary.argument.kind  ).toBe( expectedKind ) ;
        expect( unary.offset   ).toBe( 0 ) ;
        expect( unary.line     ).toBe( 1 ) ;
        expect( unary.column   ).toBe( 1 ) ;
    } ) ;

    test.each(
    [
        [ "-42n"    , "-" , 42n    ] ,
        [ "+0xFFn"  , "+" , 255n   ] ,
        [ "-1_000n" , "-" , 1000n  ]
    ] )( "unary BigInt %p -> operator %p, argument value %p" ,
         ( source , operator , expectedValue ) =>
    {
        const program = parseToAST( source ) ;
        const unary   = program.body[ 0 ] ;

        expect( unary.type     ).toBe( NodeType.UNARY_EXPRESSION ) ;
        expect( unary.operator ).toBe( operator ) ;
        expect( unary.argument.kind  ).toBe( LiteralKind.BIGINT ) ;
        expect( unary.argument.value ).toBe( expectedValue ) ;
    } ) ;

    test.each(
    [
        [ "-Infinity" , "-" , "Infinity" ] ,
        [ "+Infinity" , "+" , "Infinity" ] ,
        [ "-NaN"      , "-" , "NaN"      ] ,
        [ "+NaN"      , "+" , "NaN"      ]
    ] )( "unary numeric keyword %p -> operator %p, argument raw %p" ,
         ( source , operator , argumentRaw ) =>
    {
        const program = parseToAST( source ) ;
        const unary   = program.body[ 0 ] ;

        expect( unary.type     ).toBe( NodeType.UNARY_EXPRESSION ) ;
        expect( unary.operator ).toBe( operator ) ;
        expect( unary.argument.kind ).toBe( LiteralKind.NUMBER ) ;
        expect( unary.argument.raw  ).toBe( argumentRaw ) ;
    } ) ;

    test( "unary inside an array" , () =>
    {
        const program  = parseToAST( "[1, -2, 3]" ) ;
        const elements = program.body[ 0 ].elements ;

        expect( elements[ 1 ].type     ).toBe( NodeType.UNARY_EXPRESSION ) ;
        expect( elements[ 1 ].operator ).toBe( "-" ) ;
        expect( elements[ 1 ].argument.value ).toBe( 2 ) ;
    } ) ;

    test( "unary inside an object with Infinity keywords" , () =>
    {
        const program = parseToAST( "{ min: -Infinity, max: +Infinity }" ) ;
        const props   = program.body[ 0 ].properties ;

        expect( props[ 0 ].value.type     ).toBe( NodeType.UNARY_EXPRESSION ) ;
        expect( props[ 0 ].value.operator ).toBe( "-" ) ;
        expect( props[ 1 ].value.operator ).toBe( "+" ) ;
    } ) ;

    test( "unary position reflects the sign token" , () =>
    {
        const program = parseToAST( "  -42" ) ;
        const unary   = program.body[ 0 ] ;

        expect( unary.offset ).toBe( 2 ) ;
        expect( unary.line   ).toBe( 1 ) ;
        expect( unary.column ).toBe( 3 ) ;
    } ) ;
} ) ;

describe( "parser — unary error cases" , () =>
{
    test.each(
    [
        "-\"foo\"" ,
        "+'bar'"   ,
        "-true"    ,
        "+null"    ,
        "-undefined" ,
        "-[]"      ,
        "-{}"
    ] )( "unary on non-numeric %p is rejected" , ( source ) =>
    {
        let caught = null ;
        try
        {
            parseToAST( source ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "unary operator" ) ;
        expect( caught.message.toLowerCase() ).toContain( "number, bigint, infinity or nan" ) ;
    } ) ;

    test( "bare sign at end of input is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "-" ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
    } ) ;
} ) ;

describe( "parser — ParseOptions" , () =>
{
    test( "default options leave behavior unchanged" , () =>
    {
        const program = parseToAST( "[1, /* c */ 2, // d\n 3,]" ) ;
        const values  = program.body[ 0 ].elements.map( ( e ) => e.value ) ;
        expect( values ).toEqual( [ 1 , 2 , 3 ] ) ;
    } ) ;

    test( "allowComments: false rejects line comments" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "[1, // c\n 2]" , { allowComments: false } ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "comments are not allowed" ) ;
    } ) ;

    test( "allowComments: false rejects block comments" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "/* c */ 1" , { allowComments: false } ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
    } ) ;

    test( "allowComments: false without any comment is fine" , () =>
    {
        const program = parseToAST( "[1, 2]" , { allowComments: false } ) ;
        expect( program.body[ 0 ].elements ).toHaveLength( 2 ) ;
    } ) ;

    test( "allowTrailingCommas: false rejects trailing comma in array" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "[1, 2,]" , { allowTrailingCommas: false } ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
        expect( caught.message.toLowerCase() ).toContain( "trailing commas are not allowed" ) ;
    } ) ;

    test( "allowTrailingCommas: false rejects trailing comma in object" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "{ a: 1, b: 2, }" , { allowTrailingCommas: false } ) ;
        }
        catch ( error )
        {
            caught = error ;
        }

        expect( caught ).toBeInstanceOf( EdenSyntaxError ) ;
    } ) ;

    test( "allowTrailingCommas: false still accepts non-trailing commas" , () =>
    {
        const program = parseToAST( "[1, 2, 3]" , { allowTrailingCommas: false } ) ;
        expect( program.body[ 0 ].elements ).toHaveLength( 3 ) ;
    } ) ;

    test( "partial options preserve other defaults" , () =>
    {
        const program = parseToAST( "[1, /* c */ 2]" , { allowTrailingCommas: false } ) ;
        expect( program.body[ 0 ].elements ).toHaveLength( 2 ) ;
    } ) ;
} ) ;
