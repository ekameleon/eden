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

} ) ;

describe( "evaluator — unknown AST type" , () =>
{
    test( "forged unknown type raises EdenTypeError" , () =>
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

describe( "evaluator — AssignmentStatement" , () =>
{
    test( "identifier target on empty scope creates the key" , () =>
    {
        const scope = {} ;
        // Read-back trailing expression so the Program returns a
        // value (SPEC §3.2: assignment-only Programs yield undefined).
        const result = evalProgram( "a = 1; a" , { scope } ) ;
        expect( result ).toBe( 1 ) ;
        expect( scope.a ).toBe( 1 ) ;
    } ) ;

    test( "member target creates the parent object on the fly" , () =>
    {
        const scope = {} ;
        evalProgram( "obj.x = \"hi\"" , { scope } ) ;
        expect( scope.obj ).toEqual( { x: "hi" } ) ;
    } ) ;

    test( "deep member target builds the whole intermediate chain" , () =>
    {
        const scope = {} ;
        evalProgram( "a.b.c.d = 42" , { scope } ) ;
        expect( scope.a.b.c.d ).toBe( 42 ) ;
    } ) ;

    test( "preserves existing siblings on intermediates" , () =>
    {
        const scope = { a: { other: "kept" } } ;
        evalProgram( "a.b = 1" , { scope } ) ;
        expect( scope.a ).toEqual( { other: "kept" , b: 1 } ) ;
    } ) ;

    test( "computed key with spaces" , () =>
    {
        const scope = { obj: {} } ;
        evalProgram( "obj[\"key with space\"] = 7" , { scope } ) ;
        expect( scope.obj ).toEqual( { "key with space": 7 } ) ;
    } ) ;

    test( "numeric computed key — created on plain object (not array)" , () =>
    {
        const scope = {} ;
        evalProgram( "arr[0] = \"first\"" , { scope } ) ;
        expect( Array.isArray( scope.arr ) ).toBe( false ) ;
        expect( scope.arr ).toEqual( { "0": "first" } ) ;
    } ) ;

    test( "overwrite — second assignment replaces the first" , () =>
    {
        const scope = { a: 1 } ;
        evalProgram( "a = 2" , { scope } ) ;
        expect( scope.a ).toBe( 2 ) ;
    } ) ;

    test( "RHS is an evaluated expression — Math.sqrt result" , () =>
    {
        const scope  = { Math } ;
        const policy = { allowFunctionCall: true , authorized: [ "Math.*" ] } ;
        evalProgram( "r = Math.sqrt(9)" , { scope , policy } ) ;
        expect( scope.r ).toBe( 3 ) ;
    } ) ;

    test( "RHS is an identifier from the same scope" , () =>
    {
        const scope = { source: 7 } ;
        evalProgram( "target = source" , { scope } ) ;
        expect( scope.target ).toBe( 7 ) ;
    } ) ;

    test( "AssignmentStatement node evaluates to the assigned value" , () =>
    {
        // The Program-level rule (SPEC §3.2) hides the assignment
        // value when it is the program's last statement, but the
        // statement node itself still evaluates to the value. We
        // forge an isolated node to assert that contract directly.
        const node =
        {
            type   : NodeType.ASSIGNMENT_STATEMENT ,
            target : { type: NodeType.IDENTIFIER , name: "x" } ,
            value  : { type: NodeType.LITERAL , value: 99 , kind: LiteralKind.NUMBER }
        } ;
        expect( evalAST( node , { scope: {} } ) ).toBe( 99 ) ;
    } ) ;

    test( "writing through a primitive intermediate raises native TypeError" , () =>
    {
        // scope.s is a primitive string — writing to s.x is invalid
        // in strict mode and surfaces as the standard TypeError.
        const scope = { s: "hello" } ;
        expect( () => evalProgram( "s.x = 1" , { scope } ) ).toThrow( TypeError ) ;
    } ) ;

    test( "mutation through an existing object intermediate" , () =>
    {
        const target = { keep: 1 } ;
        const scope  = { obj: target } ;
        evalProgram( "obj.added = 2" , { scope } ) ;
        expect( target ).toBe( scope.obj ) ;        // same instance, mutated in place
        expect( target.added ).toBe( 2 ) ;
        expect( target.keep ).toBe( 1 ) ;
    } ) ;

    test( "intermediate held in `null` is replaced by an empty object" , () =>
    {
        const scope = { a: null } ;
        evalProgram( "a.b = 1" , { scope } ) ;
        expect( scope.a ).toEqual( { b: 1 } ) ;
    } ) ;

    test( "intermediate held in `undefined` is replaced by an empty object" , () =>
    {
        const scope = { a: undefined } ;
        evalProgram( "a.b = 1" , { scope } ) ;
        expect( scope.a ).toEqual( { b: 1 } ) ;
    } ) ;
} ) ;

describe( "evaluator — ArrayExpression" , () =>
{
    test( "data-mode array of scalars" , () =>
    {
        expect( evalAST( parseToAST( "[1,2,3]" ) ) ).toEqual( [ 1 , 2 , 3 ] ) ;
    } ) ;

    test( "empty array" , () =>
    {
        expect( evalAST( parseToAST( "[]" ) ) ).toEqual( [] ) ;
    } ) ;

    test( "nested arrays" , () =>
    {
        expect( evalAST( parseToAST( "[[1,2],[3]]" ) ) ).toEqual( [ [ 1 , 2 ] , [ 3 ] ] ) ;
    } ) ;

    test( "array with identifier references (eval mode)" , () =>
    {
        const scope = { a: 1 , b: 2 , c: 3 } ;
        expect( evalProgram( "[a, b, c]" , { scope } ) ).toEqual( [ 1 , 2 , 3 ] ) ;
    } ) ;

    test( "array with call expression (eval mode + policy)" , () =>
    {
        const scope  = { Math } ;
        const policy = { allowFunctionCall: true , authorized: [ "Math.*" ] } ;
        expect( evalProgram( "[Math.sqrt(4), 5]" , { scope , policy } ) ).toEqual( [ 2 , 5 ] ) ;
    } ) ;
} ) ;

describe( "evaluator — ObjectExpression (longhand)" , () =>
{
    test( "data-mode flat object" , () =>
    {
        expect( evalAST( parseToAST( "{a:1,b:2}" ) ) ).toEqual( { a: 1 , b: 2 } ) ;
    } ) ;

    test( "empty object" , () =>
    {
        expect( evalAST( parseToAST( "{}" ) ) ).toEqual( {} ) ;
    } ) ;

    test( "numeric key becomes a string key on the runtime object" , () =>
    {
        expect( evalAST( parseToAST( "{0:\"x\",42:\"y\"}" ) ) ).toEqual( { "0": "x" , "42": "y" } ) ;
    } ) ;

    test( "string key with spaces" , () =>
    {
        expect( evalAST( parseToAST( "{\"key with space\":1}" ) ) ).toEqual( { "key with space": 1 } ) ;
    } ) ;

    test( "nested objects" , () =>
    {
        expect( evalAST( parseToAST( "{a:{b:1}}" ) ) ).toEqual( { a: { b: 1 } } ) ;
    } ) ;

    test( "duplicate keys — last definition wins (forged AST)" , () =>
    {
        // The parser rejects duplicate keys in strict mode, so we
        // build the AST directly to exercise the evaluator's
        // overwrite path.
        const node =
        {
            type       : NodeType.OBJECT_EXPRESSION ,
            properties :
            [
                {
                    type      : "Property" ,
                    key       : { type: NodeType.IDENTIFIER , name: "a" } ,
                    value     : { type: NodeType.LITERAL , value: 1 , kind: LiteralKind.NUMBER } ,
                    shorthand : false ,
                    computed  : false
                } ,
                {
                    type      : "Property" ,
                    key       : { type: NodeType.IDENTIFIER , name: "a" } ,
                    value     : { type: NodeType.LITERAL , value: 2 , kind: LiteralKind.NUMBER } ,
                    shorthand : false ,
                    computed  : false
                }
            ]
        } ;
        expect( evalAST( node ) ).toEqual( { a: 2 } ) ;
    } ) ;
} ) ;

describe( "evaluator — ObjectExpression (shorthand)" , () =>
{
    test( "shorthand reads from the scope" , () =>
    {
        expect( evalProgram( "{foo}" , { scope: { foo: 42 } } ) ).toEqual( { foo: 42 } ) ;
    } ) ;

    test( "shorthand mixed with longhand" , () =>
    {
        const scope = { a: 1 , c: 3 } ;
        expect( evalProgram( "{a, b: 2, c}" , { scope } ) ).toEqual( { a: 1 , b: 2 , c: 3 } ) ;
    } ) ;

    test( "shorthand on missing identifier throws EdenReferenceError" , () =>
    {
        expect( () => evalProgram( "{missing}" , { scope: {} } ) ).toThrow( EdenReferenceError ) ;
    } ) ;
} ) ;

describe( "evaluator — ObjectExpression (computed key)" , () =>
{
    test( "computed key from a scope identifier" , () =>
    {
        const scope = { dyn: "hello" } ;
        expect( evalProgram( "{[dyn]: 1}" , { scope } ) ).toEqual( { hello: 1 } ) ;
    } ) ;

    test( "computed key from a member expression" , () =>
    {
        const scope = { obj: { k: "the-key" } } ;
        expect( evalProgram( "{[obj.k]: 7}" , { scope } ) ).toEqual( { "the-key": 7 } ) ;
    } ) ;

    test( "computed key with call expression" , () =>
    {
        const scope  = { Math } ;
        const policy = { allowFunctionCall: true , authorized: [ "Math.*" ] } ;
        expect( evalProgram( "{[Math.floor(2.7)]: \"x\"}" , { scope , policy } ) ).toEqual( { "2": "x" } ) ;
    } ) ;

    test( "computed key coerced through String() — BigInt example" , () =>
    {
        const scope = { id: 1n } ;
        expect( evalProgram( "{[id]: \"v\"}" , { scope } ) ).toEqual( { "1": "v" } ) ;
    } ) ;
} ) ;

describe( "evaluator — UnaryExpression" , () =>
{
    test.each(
    [
        [ "-1"        , -1                          ] ,
        [ "+1"        , 1                           ] ,
        [ "-1.5"      , -1.5                        ] ,
        [ "-Infinity" , Number.NEGATIVE_INFINITY    ] ,
        [ "+Infinity" , Number.POSITIVE_INFINITY    ] ,
        [ "-1n"       , -1n                         ] ,
        [ "-0xFF"     , -255                        ]
    ] )( "evalAST(parseToAST(%p)) returns %p" , ( source , expected ) =>
    {
        expect( evalAST( parseToAST( source ) ) ).toEqual( expected ) ;
    } ) ;

    test( "-NaN remains NaN (since -NaN === NaN)" , () =>
    {
        expect( Number.isNaN( evalAST( parseToAST( "-NaN" ) ) ) ).toBe( true ) ;
    } ) ;

    test( "+1n throws native TypeError (BigInt cannot cast to Number via +)" , () =>
    {
        expect( () => evalAST( parseToAST( "+1n" ) ) ).toThrow( TypeError ) ;
    } ) ;

    test( "-(identifier) in eval mode" , () =>
    {
        expect( evalProgram( "-foo" , { scope: { foo: 5 } } ) ).toBe( -5 ) ;
    } ) ;
} ) ;

describe( "evaluator — Program eval multi-statement" , () =>
{
    test( "two assignments then read returns the read value" , () =>
    {
        const scope  = {} ;
        const result = evalProgram( "a = 1; b = 2; b" , { scope } ) ;
        expect( result ).toBe( 2 ) ;
        expect( scope ).toEqual( { a: 1 , b: 2 } ) ;
    } ) ;

    test( "only assignments → result is undefined (SPEC §3.2)" , () =>
    {
        const scope  = {} ;
        const result = evalProgram( "a = 1; b = 2" , { scope } ) ;
        expect( result ).toBeUndefined() ;
        expect( scope ).toEqual( { a: 1 , b: 2 } ) ;
    } ) ;

    test( "expression after assignment uses the freshly assigned value" , () =>
    {
        const scope  = {} ;
        const result = evalProgram( "user = {name:\"Marc\"}; user.name" , { scope } ) ;
        expect( result ).toBe( "Marc" ) ;
    } ) ;

    test( "expression before final assignment is overwritten in result" , () =>
    {
        // Last visible expression is `b` (the assignment `c = 99`
        // doesn't update the result), so result === 2.
        const result = evalProgram( "a = 1; b; c = 99" , { scope: { b: 2 } } ) ;
        expect( result ).toBe( 2 ) ;
    } ) ;

    test( "single expression — no assignment — returns its value" , () =>
    {
        expect( evalProgram( "42" , { scope: {} } ) ).toBe( 42 ) ;
    } ) ;

    test( "construction + member read" , () =>
    {
        // The policy is path-based on the static AST path: `d` is
        // a local variable, so the user must whitelist `"d.*"` to
        // call methods on it. This is the documented tradeoff of
        // a static-path policy.
        const policy =
        {
            allowFunctionCall : true ,
            allowConstructor  : true ,
            authorized        : [ "Date" , "d.*" ]
        } ;
        const result = evalProgram(
            "d = new Date(\"2024-01-15\"); d.getFullYear()" ,
            { scope: { Date } , policy }
        ) ;
        expect( result ).toBe( 2024 ) ;
    } ) ;
} ) ;
