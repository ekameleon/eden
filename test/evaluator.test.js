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

describe( "SecurityPolicy — matchAuthorizedGlob via canCall / canConstruct" , () =>
{
    test( "exact match allows the configured path" , () =>
    {
        const allow = { allowFunctionCall: true , authorized: [ "Date" ] } ;
        const allowConstr = { allowConstructor: true , authorized: [ "Date" ] } ;
        // Use the evaluator surface to exercise the policy.
        const scope = { Date } ;
        expect( evalProgram( "Date()" , { scope , policy: allow } ) ).toBeDefined() ;
        expect( evalProgram( "new Date()" , { scope , policy: allowConstr } ) ).toBeInstanceOf( Date ) ;
    } ) ;

    test( "wildcard suffix authorizes any sub-path" , () =>
    {
        const policy = { allowFunctionCall: true , authorized: [ "Math.*" ] } ;
        const scope  = { Math } ;
        expect( evalProgram( "Math.sqrt(4)"   , { scope , policy } ) ).toBe( 2 ) ;
        expect( evalProgram( "Math.floor(3.9)" , { scope , policy } ) ).toBe( 3 ) ;
    } ) ;

    test( "wildcard does NOT match the bare prefix" , () =>
    {
        // `"Math.*"` does not authorize `"Math"` itself (the bare
        // prefix), so calling the Math object as a function is
        // denied even with allowFunctionCall: true.
        const policy = { allowFunctionCall: true , authorized: [ "Math.*" ] } ;
        const scope  = { Math: () => "ran" } ;
        expect( evalProgram( "Math()" , { scope , policy } ) ).toBeUndefined() ;
    } ) ;

    test( "case-sensitive: `math` does not match `Math`" , () =>
    {
        const policy = { allowFunctionCall: true , authorized: [ "Math" ] } ;
        const scope  = { math: () => "ran" } ;
        expect( evalProgram( "math()" , { scope , policy } ) ).toBeUndefined() ;
    } ) ;

    test( "empty authorized list never matches" , () =>
    {
        const policy = { allowFunctionCall: true , authorized: [] } ;
        const scope  = { foo: () => 1 } ;
        expect( evalProgram( "foo()" , { scope , policy } ) ).toBeUndefined() ;
    } ) ;
} ) ;

describe( "evaluator — CallExpression" , () =>
{
    test( "plain identifier call (allowed)" , () =>
    {
        const scope  = { foo: ( a , b ) => a + b } ;
        const policy = { allowFunctionCall: true , authorized: [ "foo" ] } ;
        expect( evalProgram( "foo(2, 3)" , { scope , policy } ) ).toBe( 5 ) ;
    } ) ;

    test( "plain identifier call denied by default returns undefined" , () =>
    {
        const scope = { foo: () => "ran" } ;
        expect( evalProgram( "foo()" , { scope } ) ).toBeUndefined() ;
    } ) ;

    test( "member-style call binds `this` to the parent object" , () =>
    {
        const scope = { obj: { x: 7 , getX: function () { return this.x ; } } } ;
        const policy = { allowFunctionCall: true , authorized: [ "obj.*" ] } ;
        expect( evalProgram( "obj.getX()" , { scope , policy } ) ).toBe( 7 ) ;
    } ) ;

    test( "deep member-style call binds `this` to the immediate parent" , () =>
    {
        const scope = { a: { b: { c: { val: 42 , read: function () { return this.val ; } } } } } ;
        const policy = { allowFunctionCall: true , authorized: [ "a.*" ] } ;
        expect( evalProgram( "a.b.c.read()" , { scope , policy } ) ).toBe( 42 ) ;
    } ) ;

    test( "Math.sqrt(4) with allowFunctionCall+Math.* authorized" , () =>
    {
        const policy = { allowFunctionCall: true , authorized: [ "Math.*" ] } ;
        expect( evalProgram( "Math.sqrt(4)" , { scope: { Math } , policy } ) ).toBe( 2 ) ;
    } ) ;

    test( "Math.sqrt with allowFunctionCall:false denies even when authorized" , () =>
    {
        const policy = { allowFunctionCall: false , authorized: [ "Math.*" ] } ;
        expect( evalProgram( "Math.sqrt(4)" , { scope: { Math } , policy } ) ).toBeUndefined() ;
    } ) ;

    test( "Math.sqrt allowed via flag but not in authorized list is denied" , () =>
    {
        const policy = { allowFunctionCall: true , authorized: [ "Date" ] } ;
        expect( evalProgram( "Math.sqrt(4)" , { scope: { Math } , policy } ) ).toBeUndefined() ;
    } ) ;

    test( "args are evaluated left-to-right even when call is denied" , () =>
    {
        const log = [] ;
        const scope =
        {
            tap : function ( value ) { log.push( value ) ; return value ; } ,
            foo : ( _a , _b ) => "ok"
        } ;
        // Allow `tap` but not `foo`, then verify both args are
        // recorded even though `foo` is denied.
        const policy = { allowFunctionCall: true , authorized: [ "tap" ] } ;
        evalProgram( "foo(tap(1), tap(2))" , { scope , policy } ) ;
        expect( log ).toEqual( [ 1 , 2 ] ) ;
    } ) ;

    test( "onDenied hook fires with the denied path" , () =>
    {
        const denied = [] ;
        const policy =
        {
            allowFunctionCall : false ,
            authorized        : [] ,
            onDenied          : ( path ) => denied.push( path )
        } ;
        evalProgram( "foo(1)" , { scope: { foo: () => 0 } , policy } ) ;
        expect( denied ).toEqual( [ "foo" ] ) ;
    } ) ;

    test( "onDenied + custom undefineable returns the custom value" , () =>
    {
        const sentinel = { denied: true } ;
        const policy =
        {
            allowFunctionCall : false ,
            authorized        : [] ,
            undefineable      : sentinel
        } ;
        expect( evalProgram( "foo()" , { scope: { foo: () => 0 } , policy } ) ).toBe( sentinel ) ;
    } ) ;

    test( "calling a missing identifier raises EdenReferenceError even with permissive policy" , () =>
    {
        const policy = { allowFunctionCall: true , authorized: [ "missing" ] } ;
        expect( () => evalProgram( "missing()" , { scope: {} , policy } ) ).toThrow( EdenReferenceError ) ;
    } ) ;

    test( "static method call on a class (Number.parseInt)" , () =>
    {
        const policy = { allowFunctionCall: true , authorized: [ "Number.*" ] } ;
        expect( evalProgram( "Number.parseInt(\"42\")" , { scope: { Number } , policy } ) ).toBe( 42 ) ;
    } ) ;
} ) ;

describe( "evaluator — NewExpression" , () =>
{
    test( "new Date() with default policy" , () =>
    {
        // Default policy has allowConstructor:true and Date in
        // authorized — but the user scope must still expose Date.
        expect( evalProgram( "new Date()" , { scope: { Date } } ) ).toBeInstanceOf( Date ) ;
    } ) ;

    test( "new Date(<iso>) returns the same instant as JS new Date(...)" , () =>
    {
        const result = evalProgram( "new Date(\"2024-01-15\")" , { scope: { Date } } ) ;
        expect( result ).toBeInstanceOf( Date ) ;
        expect( result.toISOString().slice( 0 , 10 ) ).toBe( "2024-01-15" ) ;
    } ) ;

    test( "new Foo with custom class needs Foo in authorized" , () =>
    {
        class Foo
        {
            constructor( x , y ) { this.sum = x + y ; }
        }
        const policy = { allowConstructor: true , authorized: [ "Foo" ] } ;
        const result = evalProgram( "new Foo(2, 3)" , { scope: { Foo } , policy } ) ;
        expect( result.sum ).toBe( 5 ) ;
    } ) ;

    test( "new Foo() denied when Foo is not in authorized" , () =>
    {
        class Foo { constructor() { this.ok = true ; } }
        const policy = { allowConstructor: true , authorized: [] } ;
        expect( evalProgram( "new Foo()" , { scope: { Foo } , policy } ) ).toBeUndefined() ;
    } ) ;

    test( "allowConstructor:false denies all new expressions" , () =>
    {
        const policy = { allowConstructor: false , authorized: [ "Date" ] } ;
        expect( evalProgram( "new Date()" , { scope: { Date } , policy } ) ).toBeUndefined() ;
    } ) ;

    test( "onDenied fires on denied new with the path" , () =>
    {
        const denied = [] ;
        class Foo {}
        const policy =
        {
            allowConstructor : true ,
            authorized       : [] ,
            onDenied         : ( path ) => denied.push( path )
        } ;
        evalProgram( "new Foo()" , { scope: { Foo } , policy } ) ;
        expect( denied ).toEqual( [ "Foo" ] ) ;
    } ) ;

    test( "new <missing> raises EdenReferenceError with permissive policy" , () =>
    {
        const policy = { allowConstructor: true , authorized: [ "Missing" ] } ;
        expect( () => evalProgram( "new Missing()" , { scope: {} , policy } ) ).toThrow( EdenReferenceError ) ;
    } ) ;

    test( "new with dotted callee path (new Mod.Sub)" , () =>
    {
        class Sub { constructor( v ) { this.v = v ; } }
        const Mod    = { Sub } ;
        const policy = { allowConstructor: true , authorized: [ "Mod.*" ] } ;
        const result = evalProgram( "new Mod.Sub(7)" , { scope: { Mod } , policy } ) ;
        expect( result.v ).toBe( 7 ) ;
    } ) ;
} ) ;

describe( "evaluator — combined call / new" , () =>
{
    test( "new Date(Math.floor(timestamp)) — both invocations gated independently" , () =>
    {
        const policy =
        {
            allowFunctionCall : true ,
            allowConstructor  : true ,
            authorized        : [ "Date" , "Math.*" ]
        } ;
        const scope  = { Date , Math , timestamp: 1700000000000 } ;
        const result = evalProgram( "new Date(Math.floor(timestamp))" , { scope , policy } ) ;
        expect( result ).toBeInstanceOf( Date ) ;
        expect( result.getTime() ).toBe( 1700000000000 ) ;
    } ) ;

    test( "nested calls — outer denied, inner allowed: outer returns undefined, inner ran" , () =>
    {
        const log = [] ;
        const scope =
        {
            inner : () => { log.push( "inner" ) ; return 7 ; } ,
            outer : ( _v ) => "outer-ran"
        } ;
        const policy = { allowFunctionCall: true , authorized: [ "inner" ] } ;
        expect( evalProgram( "outer(inner())" , { scope , policy } ) ).toBeUndefined() ;
        expect( log ).toEqual( [ "inner" ] ) ;
    } ) ;
} ) ;
