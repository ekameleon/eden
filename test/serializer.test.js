/**
 * @file Unit tests for the serializer.
 *
 * This file grows with every serializer sub-step. Sub-step 4.1
 * covers the skeleton and the non-textual scalar literals: `null`,
 * `undefined`, booleans, numbers (with `NaN` and `±Infinity`) and
 * `BigInt`. Strings, arrays, objects, unary expressions and
 * eval-mode nodes land in the subsequent sub-steps.
 *
 * The tests import `stringify` and `stringifyAST` from their
 * source files directly because they are not yet re-exported from
 * the public façade (`src/index.js`) — that wiring is deferred to
 * sub-step 4.7.
 */

import { describe , test , expect } from "bun:test" ;

import {
    parseToAST ,
    EdenTypeError ,
    NodeType ,
    LiteralKind ,
    ProgramMode
}
from "../src/index.js" ;

import stringify    from "../src/serializer/stringify.js" ;
import stringifyAST from "../src/serializer/stringifyAST.js" ;

describe( "stringify — primitives" , () =>
{
    test( "null"      , () => { expect( stringify( null      ) ).toBe( "null"      ) ; } ) ;
    test( "undefined" , () => { expect( stringify( undefined ) ).toBe( "undefined" ) ; } ) ;
    test( "true"      , () => { expect( stringify( true      ) ).toBe( "true"      ) ; } ) ;
    test( "false"     , () => { expect( stringify( false     ) ).toBe( "false"     ) ; } ) ;

    test.each(
    [
        [ 0     , "0"     ] ,
        [ 1     , "1"     ] ,
        [ -1    , "-1"    ] ,
        [ 42    , "42"    ] ,
        [ 1.5   , "1.5"   ] ,
        [ -1.5  , "-1.5"  ] ,
        [ 1e21  , "1e+21" ]
    ] )( "finite number %p → %p" , ( input , expected ) =>
    {
        expect( stringify( input ) ).toBe( expected ) ;
    } ) ;
} ) ;

describe( "stringify — number specials" , () =>
{
    test( "NaN"        , () => { expect( stringify( Number.NaN               ) ).toBe( "NaN"       ) ; } ) ;
    test( "+Infinity"  , () => { expect( stringify( Number.POSITIVE_INFINITY ) ).toBe( "Infinity"  ) ; } ) ;
    test( "-Infinity"  , () => { expect( stringify( Number.NEGATIVE_INFINITY ) ).toBe( "-Infinity" ) ; } ) ;

    test( "NaN in jsonCompatible mode collapses to null" , () =>
    {
        expect( stringify( Number.NaN , { jsonCompatible: true } ) ).toBe( "null" ) ;
    } ) ;

    test( "+Infinity in jsonCompatible mode collapses to null" , () =>
    {
        expect( stringify( Number.POSITIVE_INFINITY , { jsonCompatible: true } ) ).toBe( "null" ) ;
    } ) ;

    test( "-Infinity in jsonCompatible mode collapses to null" , () =>
    {
        expect( stringify( Number.NEGATIVE_INFINITY , { jsonCompatible: true } ) ).toBe( "null" ) ;
    } ) ;

    test( "undefined in jsonCompatible mode collapses to null" , () =>
    {
        expect( stringify( undefined , { jsonCompatible: true } ) ).toBe( "null" ) ;
    } ) ;
} ) ;

describe( "stringify — bigint" , () =>
{
    test( "0n"                  , () => { expect( stringify( 0n                  ) ).toBe( "0n"                  ) ; } ) ;
    test( "1n"                  , () => { expect( stringify( 1n                  ) ).toBe( "1n"                  ) ; } ) ;
    test( "9007199254740993n"   , () => { expect( stringify( 9007199254740993n   ) ).toBe( "9007199254740993n"   ) ; } ) ;
    test( "-9007199254740993n"  , () => { expect( stringify( -9007199254740993n  ) ).toBe( "-9007199254740993n"  ) ; } ) ;

    test( "BigInt in jsonCompatible mode throws EdenTypeError" , () =>
    {
        expect( () => stringify( 1n , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringify — not yet implemented" , () =>
{
    test( "string values raise EdenTypeError" , () =>
    {
        expect( () => stringify( "hello" ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "array values raise EdenTypeError" , () =>
    {
        expect( () => stringify( [ 1 , 2 , 3 ] ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "plain object values raise EdenTypeError" , () =>
    {
        expect( () => stringify( { a: 1 } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringifyAST — guards" , () =>
{
    test( "null input throws EdenTypeError" , () =>
    {
        expect( () => stringifyAST( null ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "non-object input throws EdenTypeError" , () =>
    {
        expect( () => stringifyAST( 42 ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "object without a string \"type\" throws EdenTypeError" , () =>
    {
        expect( () => stringifyAST( { foo: 1 } ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "unsupported AST node type throws EdenTypeError" , () =>
    {
        const fakeArray =
        {
            type     : NodeType.ARRAY_EXPRESSION ,
            elements : []
        } ;
        expect( () => stringifyAST( fakeArray ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringifyAST — Literal nodes preserve raw" , () =>
{
    test.each(
    [
        [ "null"        ] ,
        [ "undefined"   ] ,
        [ "true"        ] ,
        [ "false"       ] ,
        [ "NaN"         ] ,
        [ "Infinity"    ] ,
        [ "0"           ] ,
        [ "42"          ] ,
        [ "1.5"         ] ,
        [ "0xFF"        ] ,
        [ "0o17"        ] ,
        [ "0b1010"      ] ,
        [ "1_000_000"   ] ,
        [ "1e10"        ] ,
        [ "0n"          ] ,
        [ "1_000n"      ] ,
        [ "0xFFn"       ]
    ] )( "round trip of %p preserves the original lexeme" , ( source ) =>
    {
        const program = parseToAST( source ) ;
        expect( stringifyAST( program ) ).toBe( source ) ;
    } ) ;

    test( "jsonCompatible recomputes numeric literals from value" , () =>
    {
        const program = parseToAST( "0xFF" ) ;
        expect( stringifyAST( program , { jsonCompatible: true } ) ).toBe( "255" ) ;
    } ) ;

    test( "jsonCompatible drops numeric separators" , () =>
    {
        const program = parseToAST( "1_000_000" ) ;
        expect( stringifyAST( program , { jsonCompatible: true } ) ).toBe( "1000000" ) ;
    } ) ;

    test( "jsonCompatible rejects BigInt literals even when raw is available" , () =>
    {
        const program = parseToAST( "1_000n" ) ;
        expect( () => stringifyAST( program , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringifyAST — Program node" , () =>
{
    test( "empty data-mode Program serializes to the empty string" , () =>
    {
        const emptyProgram =
        {
            type : NodeType.PROGRAM   ,
            mode : ProgramMode.DATA   ,
            body : []
        } ;
        expect( stringifyAST( emptyProgram ) ).toBe( "" ) ;
    } ) ;

    test( "data-mode Program wrapping a single Literal serializes through" , () =>
    {
        const program = parseToAST( "true" ) ;
        expect( program.mode ).toBe( ProgramMode.DATA ) ;
        expect( program.body ).toHaveLength( 1 ) ;
        expect( program.body[ 0 ].kind ).toBe( LiteralKind.BOOLEAN ) ;
        expect( stringifyAST( program ) ).toBe( "true" ) ;
    } ) ;

    test( "eval-mode Program is rejected in sub-step 4.1" , () =>
    {
        const evalProgram =
        {
            type : NodeType.PROGRAM ,
            mode : ProgramMode.EVAL ,
            body : []
        } ;
        expect( () => stringifyAST( evalProgram ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "data-mode Program with more than one body element is rejected" , () =>
    {
        const program =
        {
            type : NodeType.PROGRAM ,
            mode : ProgramMode.DATA ,
            body :
            [
                { type: NodeType.LITERAL , value: 1 , raw: "1" , kind: LiteralKind.NUMBER } ,
                { type: NodeType.LITERAL , value: 2 , raw: "2" , kind: LiteralKind.NUMBER }
            ]
        } ;
        expect( () => stringifyAST( program ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;
