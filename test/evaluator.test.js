/**
 * @file Unit tests for the evaluator.
 *
 * This file grows with every evaluator sub-step. Sub-step 6.1
 * covers the scaffolding and the simplest cases: scalar `Literal`
 * nodes of every `kind`, and `Program` nodes with a body of length
 * ≤ 1. Identifier resolution, member access, security policy, calls,
 * constructors, assignments and composite values land in the next
 * sub-steps.
 *
 * `evalAST` is imported from its source path: it is not yet
 * re-exported from the public façade — that wiring is deferred to
 * issue #7.
 */

import { describe , test , expect } from "bun:test" ;

import {
    parseToAST ,
    NodeType ,
    LiteralKind ,
    ProgramMode ,
    EdenReferenceError ,
    EdenTypeError
}
from "../src/index.js" ;

import evalAST from "../src/evaluator/helpers/evalAST.js" ;

describe( "evaluator — scalar literals" , () =>
{
    test.each(
    [
        [ "null"           , null                       ] ,
        [ "true"           , true                       ] ,
        [ "false"          , false                      ] ,
        [ "undefined"      , undefined                  ] ,
        [ "42"             , 42                         ] ,
        [ "1.5"            , 1.5                        ] ,
        [ "0xFF"           , 255                        ] ,
        [ "1n"             , 1n                         ] ,
        [ "9007199254740993n" , 9007199254740993n       ] ,
        [ "\"hello\""      , "hello"                    ] ,
        [ "'world'"        , "world"                    ] ,
        [ "`multi\\nline`" , "multi\nline"              ]
    ] )( "evalAST(parseToAST(%p)) returns the expected value" , ( source , expected ) =>
    {
        expect( evalAST( parseToAST( source ) ) ).toEqual( expected ) ;
    } ) ;

    test( "NaN resolves to Number.NaN" , () =>
    {
        expect( Number.isNaN( evalAST( parseToAST( "NaN" ) ) ) ).toBe( true ) ;
    } ) ;

    test( "Infinity resolves to +Infinity" , () =>
    {
        expect( evalAST( parseToAST( "Infinity" ) ) ).toBe( Number.POSITIVE_INFINITY ) ;
    } ) ;
} ) ;

describe( "evaluator — Program" , () =>
{
    test( "empty data-mode Program yields undefined" , () =>
    {
        const node = { type: NodeType.PROGRAM , mode: ProgramMode.DATA , body: [] } ;
        expect( evalAST( node ) ).toBeUndefined() ;
    } ) ;

    test( "data-mode Program wrapping a Literal yields its value" , () =>
    {
        expect( evalAST( parseToAST( "42" ) ) ).toBe( 42 ) ;
    } ) ;

    test( "empty eval-mode Program yields undefined" , () =>
    {
        const node = { type: NodeType.PROGRAM , mode: ProgramMode.EVAL , body: [] } ;
        expect( evalAST( node ) ).toBeUndefined() ;
    } ) ;

    test( "eval-mode Program wrapping a single Literal yields its value" , () =>
    {
        const program = parseToAST( "42" , { mode: ProgramMode.EVAL } ) ;
        expect( evalAST( program ) ).toBe( 42 ) ;
    } ) ;

    test( "multi-statement eval-mode Program raises EdenTypeError (6.1 scope)" , () =>
    {
        const program = parseToAST( "1; 2" , { mode: ProgramMode.EVAL } ) ;
        expect( () => evalAST( program ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "evaluator — not yet implemented" , () =>
{
    test( "ArrayExpression (data-mode source) raises EdenTypeError" , () =>
    {
        const program = parseToAST( "[1,2,3]" ) ;
        expect( () => evalAST( program ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "ObjectExpression (data-mode source) raises EdenTypeError" , () =>
    {
        const program = parseToAST( "{a:1}" ) ;
        expect( () => evalAST( program ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "UnaryExpression raises EdenTypeError" , () =>
    {
        const program = parseToAST( "-1" ) ;
        expect( () => evalAST( program ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "unknown AST node type raises EdenTypeError" , () =>
    {
        const forged = { type: "FakeNodeType" } ;
        expect( () => evalAST( forged ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "evaluator — options" , () =>
{
    test( "accepts an EvaluateOptions object without throwing" , () =>
    {
        const result = evalAST(
            parseToAST( "42" ) ,
            { scope: { x: 1 } , policy: { allowFunctionCall: true } }
        ) ;
        expect( result ).toBe( 42 ) ;
    } ) ;

    test( "tolerates a missing options argument" , () =>
    {
        expect( evalAST( parseToAST( "true" ) ) ).toBe( true ) ;
    } ) ;
} ) ;

/**
 * Convenience helper — parses an eval-mode source so identifier-
 * and member-expression tests stay short.
 *
 * @param   {string} source
 * @returns {object}
 */
function evalProgram( source , options )
{
    return evalAST( parseToAST( source , { mode: ProgramMode.EVAL } ) , options ) ;
}

describe( "evaluator — Identifier resolution" , () =>
{
    test( "resolves an identifier present on the scope" , () =>
    {
        expect( evalProgram( "foo" , { scope: { foo: 42 } } ) ).toBe( 42 ) ;
    } ) ;

    test( "resolves an identifier holding a string" , () =>
    {
        expect( evalProgram( "title" , { scope: { title: "Hello" } } ) ).toBe( "Hello" ) ;
    } ) ;

    test( "resolves an identifier holding an object" , () =>
    {
        const target = { x: 1 } ;
        expect( evalProgram( "obj" , { scope: { obj: target } } ) ).toBe( target ) ;
    } ) ;

    test( "missing identifier raises EdenReferenceError" , () =>
    {
        expect( () => evalProgram( "missing" , { scope: {} } ) ).toThrow( EdenReferenceError ) ;
    } ) ;

    test( "missing identifier with a related key still throws" , () =>
    {
        expect( () => evalProgram( "foo" , { scope: { Foo: 1 } } ) ).toThrow( EdenReferenceError ) ;
    } ) ;

    test( "identifier holding undefined returns undefined (key exists)" , () =>
    {
        // Subtle: the property is present on the scope, its value is
        // undefined. That is NOT the same as the property being
        // missing, so resolution succeeds.
        expect( evalProgram( "maybe" , { scope: { maybe: undefined } } ) ).toBeUndefined() ;
    } ) ;
} ) ;

describe( "evaluator — MemberExpression (dotted)" , () =>
{
    test( "one-level dotted path" , () =>
    {
        expect( evalProgram( "obj.x" , { scope: { obj: { x: 7 } } } ) ).toBe( 7 ) ;
    } ) ;

    test( "two-level dotted path" , () =>
    {
        expect( evalProgram( "a.b.c" , { scope: { a: { b: { c: "deep" } } } } ) ).toBe( "deep" ) ;
    } ) ;

    test( "missing intermediate segment throws with descriptive path" , () =>
    {
        try
        {
            evalProgram( "a.b.c" , { scope: { a: {} } } ) ;
            throw new Error( "should have thrown" ) ;
        }
        catch ( error )
        {
            expect( error ).toBeInstanceOf( EdenReferenceError ) ;
            expect( error.message ).toContain( "a.b" ) ;
        }
    } ) ;

    test( "descent through null raises EdenReferenceError" , () =>
    {
        expect( () => evalProgram( "a.b" , { scope: { a: null } } ) ).toThrow( EdenReferenceError ) ;
    } ) ;

    test( "descent through undefined raises EdenReferenceError" , () =>
    {
        expect( () => evalProgram( "a.b" , { scope: { a: undefined } } ) ).toThrow( EdenReferenceError ) ;
    } ) ;

    test( "auto-boxing — string.length resolves" , () =>
    {
        expect( evalProgram( "s.length" , { scope: { s: "hello" } } ) ).toBe( 5 ) ;
    } ) ;
} ) ;

describe( "evaluator — MemberExpression (computed)" , () =>
{
    test( "string-literal key" , () =>
    {
        expect( evalProgram( "obj[\"x\"]" , { scope: { obj: { x: 1 } } } ) ).toBe( 1 ) ;
    } ) ;

    test( "string-literal key with spaces" , () =>
    {
        expect( evalProgram( "obj[\"key with space\"]" , { scope: { obj: { "key with space": "OK" } } } ) ).toBe( "OK" ) ;
    } ) ;

    test( "numeric-literal key (array access)" , () =>
    {
        expect( evalProgram( "arr[0]" , { scope: { arr: [ 10 , 20 , 30 ] } } ) ).toBe( 10 ) ;
        expect( evalProgram( "arr[2]" , { scope: { arr: [ 10 , 20 , 30 ] } } ) ).toBe( 30 ) ;
    } ) ;

    test( "hex numeric key coerces to its decimal string segment" , () =>
    {
        const scope = { arr: { 255: "two-fifty-five" } } ;
        expect( evalProgram( "arr[0xFF]" , { scope } ) ).toBe( "two-fifty-five" ) ;
    } ) ;

    test( "out-of-range array index throws" , () =>
    {
        expect( () => evalProgram( "arr[10]" , { scope: { arr: [ 1 , 2 , 3 ] } } ) ).toThrow( EdenReferenceError ) ;
    } ) ;

    test( "mixed dotted + computed segments" , () =>
    {
        const scope = { users: [ { name: "Marc" } , { name: "Eve" } ] } ;
        expect( evalProgram( "users[1].name" , { scope } ) ).toBe( "Eve" ) ;
    } ) ;
} ) ;

describe( "evaluator — Scope.resolve error messages" , () =>
{
    test( "missing path message names the failing segment chain" , () =>
    {
        try
        {
            evalProgram( "a.b.c" , { scope: { a: { b: { other: 1 } } } } ) ;
            throw new Error( "should have thrown" ) ;
        }
        catch ( error )
        {
            expect( error.message ).toContain( "a.b.c" ) ;
            expect( error.message ).toContain( "not defined" ) ;
        }
    } ) ;

    test( "null-descent message tells which segment was attempted on null" , () =>
    {
        try
        {
            evalProgram( "a.b" , { scope: { a: null } } ) ;
            throw new Error( "should have thrown" ) ;
        }
        catch ( error )
        {
            expect( error.message ).toContain( "null" ) ;
            expect( error.message ).toContain( "\"b\"" ) ;
        }
    } ) ;
} ) ;
