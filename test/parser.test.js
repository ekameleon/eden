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

    test( "non-keyword token at program start is rejected" , () =>
    {
        let caught = null ;
        try
        {
            parseToAST( "42" ) ;
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
