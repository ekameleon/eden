/**
 * @file Smoke coverage for the public API surface exported by
 *       `src/index.js`.
 *
 * The tests in this file are intentionally shallow: they confirm
 * that every symbol the library advertises is actually exported
 * with the right shape, and that the most idiomatic round trips
 * (`parse → stringify`, `parseToAST → stringifyAST`) work end to
 * end through the public façade. Deeper behavior is covered by
 * the per-module test files (`lexer.test.js`, `parser.test.js`,
 * `serializer.test.js`).
 *
 * Any change that adds, removes or renames a public export should
 * also update this file — making it explicit that the surface is
 * part of the supported contract.
 */

import { describe , test , expect } from "bun:test" ;

import * as eden from "../src/index.js" ;

describe( "public API — exports presence and shape" , () =>
{
    test.each(
    [
        [ "parse"           , "function" ] ,
        [ "parseToAST"      , "function" ] ,
        [ "stringify"       , "function" ] ,
        [ "stringifyAST"    , "function" ] ,
        [ "fromJSON"        , "function" ] ,
        [ "toJSON"          , "function" ] ,
        [ "tokenize"        , "function" ] ,
        [ "EdenError"       , "function" ] ,   // classes show up as `typeof === "function"`
        [ "EdenSyntaxError" , "function" ] ,
        [ "EdenTypeError"   , "function" ] ,
        [ "TokenType"       , "object"   ] ,
        [ "NodeType"        , "object"   ] ,
        [ "LiteralKind"     , "object"   ] ,
        [ "ProgramMode"     , "object"   ]
    ] )( "exports %p as a %s" , ( name , expectedType ) =>
    {
        expect( eden[ name ] ).toBeDefined() ;
        expect( typeof eden[ name ] ).toBe( expectedType ) ;
    } ) ;

    test( "VERSION is a non-empty string" , () =>
    {
        expect( typeof eden.VERSION ).toBe( "string" ) ;
        expect( eden.VERSION.length ).toBeGreaterThan( 0 ) ;
    } ) ;

    test( "every enum object is frozen" , () =>
    {
        expect( Object.isFrozen( eden.TokenType   ) ).toBe( true ) ;
        expect( Object.isFrozen( eden.NodeType    ) ).toBe( true ) ;
        expect( Object.isFrozen( eden.LiteralKind ) ).toBe( true ) ;
        expect( Object.isFrozen( eden.ProgramMode ) ).toBe( true ) ;
    } ) ;

    test( "internal classes are NOT re-exported" , () =>
    {
        // Lexer, Parser and Serializer must stay implementation details.
        expect( eden.Lexer      ).toBeUndefined() ;
        expect( eden.Parser     ).toBeUndefined() ;
        expect( eden.Serializer ).toBeUndefined() ;
    } ) ;
} ) ;

describe( "public API — value round trip via parse / stringify" , () =>
{
    test.each(
    [
        [ "null"      , null                                 ] ,
        [ "true"      , true                                 ] ,
        [ "false"     , false                                ] ,
        [ "number"    , 42                                   ] ,
        [ "bigint"    , 9007199254740993n                    ] ,
        [ "string"    , "hello"                              ] ,
        [ "array"     , [ 1 , 2 , 3 ]                        ] ,
        [ "object"    , { name: "Marc" , active: true }      ] ,
        [ "nested"    , { tags: [ "dev" , "maker" ] , count: 42 } ]
    ] )( "parse(stringify(%p)) deep-equals the original" , ( _label , value ) =>
    {
        expect( eden.parse( eden.stringify( value ) ) ).toEqual( value ) ;
    } ) ;
} ) ;

describe( "public API — AST round trip via parseToAST / stringifyAST" , () =>
{
    test.each(
    [
        [ "null"                  ] ,
        [ "{a:1,b:[2,3]}"         ] ,
        [ "[0xFF,1_000n,\"hi\"]"  ] ,
        [ "{name:\"Marc\",active:true,tags:[\"dev\",\"maker\"]}" ]
    ] )( "stringifyAST is idempotent on %p (twice yields the same string)" , ( source ) =>
    {
        const once  = eden.stringifyAST( eden.parseToAST( source ) ) ;
        const twice = eden.stringifyAST( eden.parseToAST( once ) ) ;
        expect( twice ).toBe( once ) ;
    } ) ;
} ) ;

describe( "public API — JSON-compatible round trip" , () =>
{
    test( "output is parseable by JSON.parse for typical data" , () =>
    {
        const value   = { name: "Marc" , active: true , tags: [ "dev" , "maker" ] , count: 42 } ;
        const encoded = eden.stringify( value , { jsonCompatible: true } ) ;
        expect( JSON.parse( encoded ) ).toEqual( value ) ;
    } ) ;

    test( "jsonCompatible substitutions (NaN, Infinity, undefined) match the documented behavior" , () =>
    {
        const value   = { good: 1 , gone: undefined , inf: Infinity , nope: Number.NaN } ;
        const encoded = eden.stringify( value , { jsonCompatible: true } ) ;
        expect( JSON.parse( encoded ) ).toEqual( { good: 1 , inf: null , nope: null } ) ;
    } ) ;
} ) ;

describe( "public API — tokenize is available for tooling" , () =>
{
    test( "tokenize returns a non-empty token array ending with EOF" , () =>
    {
        const tokens = eden.tokenize( "{a:1}" ) ;
        expect( Array.isArray( tokens ) ).toBe( true ) ;
        expect( tokens.length ).toBeGreaterThan( 0 ) ;
        expect( tokens[ tokens.length - 1 ].type ).toBe( eden.TokenType.EOF ) ;
    } ) ;
} ) ;
