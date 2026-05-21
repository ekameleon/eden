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

describe( "evaluator — not yet implemented in 6.1" , () =>
{
    test( "Identifier node raises EdenTypeError" , () =>
    {
        const node = { type: NodeType.IDENTIFIER , name: "foo" } ;
        expect( () => evalAST( node ) ).toThrow( EdenTypeError ) ;
    } ) ;

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
