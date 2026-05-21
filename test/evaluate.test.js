/**
 * @file Unit tests for the public `evaluate()` entry point.
 *
 * The tests focus on the entry-point contract — wiring,
 * option forwarding, mode override, error propagation — rather
 * than re-testing the evaluator surface itself (already covered
 * by `evaluator.test.js`).
 */

import { describe , test , expect } from "bun:test" ;

import {
    evaluate ,
    ProgramMode ,
    EdenSyntaxError ,
    EdenReferenceError
}
from "../src/index.js" ;

describe( "evaluate — basic eval-mode programs" , () =>
{
    test( "identifier read" , () =>
    {
        expect( evaluate( "foo" , { scope: { foo: 42 } } ) ).toBe( 42 ) ;
    } ) ;

    test( "multi-statement: assignment then read" , () =>
    {
        const scope = {} ;
        expect( evaluate( "a = 1; a" , { scope } ) ).toBe( 1 ) ;
        expect( scope.a ).toBe( 1 ) ;
    } ) ;

    test( "object literal as the single expression" , () =>
    {
        expect( evaluate( "{a:1,b:2}" , {} ) ).toEqual( { a: 1 , b: 2 } ) ;
    } ) ;

    test( "scope mutation is visible after evaluate returns" , () =>
    {
        const scope = { obj: { x: 0 } } ;
        evaluate( "obj.x = 7" , { scope } ) ;
        expect( scope.obj.x ).toBe( 7 ) ;
    } ) ;

    test( "empty source yields undefined" , () =>
    {
        expect( evaluate( "" , {} ) ).toBeUndefined() ;
    } ) ;
} ) ;

describe( "evaluate — policy forwarding" , () =>
{
    test( "Math.sqrt(4) with permissive policy returns 2" , () =>
    {
        const policy = { allowFunctionCall: true , authorized: [ "Math.*" ] } ;
        expect( evaluate( "Math.sqrt(4)" , { scope: { Math } , policy } ) ).toBe( 2 ) ;
    } ) ;

    test( "Math.sqrt(4) with default policy is denied → undefined" , () =>
    {
        expect( evaluate( "Math.sqrt(4)" , { scope: { Math } } ) ).toBeUndefined() ;
    } ) ;

    test( "new Date(<iso>) with default policy succeeds" , () =>
    {
        const result = evaluate( "new Date(\"2024-01-15\")" , { scope: { Date } } ) ;
        expect( result ).toBeInstanceOf( Date ) ;
    } ) ;

    test( "denied call assigns the configured undefineable sentinel" , () =>
    {
        const policy =
        {
            allowFunctionCall : false ,
            authorized        : [] ,
            undefineable      : "DENIED"
        } ;
        expect( evaluate( "forbidden()" , { scope: { forbidden: () => 1 } , policy } ) ).toBe( "DENIED" ) ;
    } ) ;
} ) ;

describe( "evaluate — option forwarding" , () =>
{
    test( "ParseOptions reach the parser (allowComments: false rejects commented source)" , () =>
    {
        expect( () => evaluate( "// comment\nfoo" , { allowComments: false , scope: { foo: 1 } } ) )
            .toThrow( EdenSyntaxError ) ;
    } ) ;

    test( "mode option from the caller is silently overridden to eval" , () =>
    {
        // mode:"data" would reject a multi-statement source — the
        // override to eval mode lets the source through and the
        // evaluator runs it normally.
        const result = evaluate( "a = 1; a" , { scope: {} , mode: ProgramMode.DATA } ) ;
        expect( result ).toBe( 1 ) ;
    } ) ;
} ) ;

describe( "evaluate — error propagation" , () =>
{
    test( "malformed source raises EdenSyntaxError from the parser" , () =>
    {
        expect( () => evaluate( "{ not valid" , {} ) ).toThrow( EdenSyntaxError ) ;
    } ) ;

    test( "unresolved identifier raises EdenReferenceError from the evaluator" , () =>
    {
        expect( () => evaluate( "missing" , { scope: {} } ) ).toThrow( EdenReferenceError ) ;
    } ) ;

    test( "unresolved deep path raises EdenReferenceError" , () =>
    {
        expect( () => evaluate( "a.b.c" , { scope: { a: {} } } ) ).toThrow( EdenReferenceError ) ;
    } ) ;
} ) ;
