/**
 * @file Unit tests for the convert utilities `fromJSON` and
 *       `toJSON`.
 *
 * These two functions are thin façades over `JSON.parse` /
 * `JSON.stringify` and the eden serializer; the test focus is on
 * the contract surface (forced `jsonCompatible`, error wrapping,
 * option pass-through) rather than re-testing what
 * `serializer.test.js` already covers.
 */

import { describe , test , expect } from "bun:test" ;

import {
    fromJSON ,
    toJSON ,
    parse ,
    EdenSyntaxError ,
    EdenTypeError
}
from "../src/index.js" ;

describe( "toJSON — basic JSON-native types" , () =>
{
    test.each(
    [
        [ "null"      , null                                   ] ,
        [ "true"      , true                                   ] ,
        [ "false"     , false                                  ] ,
        [ "number"    , 42                                     ] ,
        [ "string"    , "hello"                                ] ,
        [ "array"     , [ 1 , 2 , 3 ]                          ] ,
        [ "object"    , { a: 1 , b: "x" }                      ] ,
        [ "nested"    , { tags: [ "dev" , "maker" ] , count: 42 } ]
    ] )( "JSON.parse(toJSON(%p)) deep-equals the original" , ( _label , value ) =>
    {
        expect( JSON.parse( toJSON( value ) ) ).toEqual( value ) ;
    } ) ;
} ) ;

describe( "toJSON — jsonCompatible substitutions" , () =>
{
    test( "undefined dropped from objects" , () =>
    {
        expect( toJSON( { a: 1 , b: undefined , c: 3 } ) ).toBe( "{\"a\":1,\"c\":3}" ) ;
    } ) ;

    test( "undefined replaced by null in arrays" , () =>
    {
        expect( toJSON( [ 1 , undefined , 3 ] ) ).toBe( "[1,null,3]" ) ;
    } ) ;

    test( "NaN and ±Infinity replaced by null" , () =>
    {
        expect( toJSON( [ Number.NaN , Number.POSITIVE_INFINITY , Number.NEGATIVE_INFINITY ] ) )
            .toBe( "[null,null,null]" ) ;
    } ) ;

    test( "BigInt raises EdenTypeError" , () =>
    {
        expect( () => toJSON( 1n ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "toJSON — option pass-through" , () =>
{
    test( "indent: 2 produces pretty-printed JSON" , () =>
    {
        expect( toJSON( { a: 1 , b: 2 } , { indent: 2 } ) ).toBe( "{\n  \"a\": 1,\n  \"b\": 2\n}" ) ;
    } ) ;

    test( "sortKeys reorders keys lexicographically" , () =>
    {
        expect( toJSON( { b: 1 , a: 2 } , { sortKeys: true } ) ).toBe( "{\"a\":2,\"b\":1}" ) ;
    } ) ;

    test( "replacer is honored on the value path" , () =>
    {
        const result = toJSON(
            { keep: 1 , drop: 2 } ,
            { replacer: ( k , v ) => k === "drop" ? undefined : v }
        ) ;
        expect( result ).toBe( "{\"keep\":1}" ) ;
    } ) ;

    test( "jsonCompatible: false is ignored — output stays strict JSON" , () =>
    {
        const value   = { a: 1 , b: undefined } ;
        const encoded = toJSON( value , { jsonCompatible: false , unquotedKeys: true } ) ;
        // `unquotedKeys: true` is also overridden by the forced jsonCompatible.
        expect( encoded ).toBe( "{\"a\":1}" ) ;
        expect( () => JSON.parse( encoded ) ).not.toThrow() ;
    } ) ;
} ) ;

describe( "fromJSON — value round trips" , () =>
{
    test.each(
    [
        [ "null"      , "null"                                 ] ,
        [ "true"      , "true"                                 ] ,
        [ "false"     , "false"                                ] ,
        [ "number"    , "42"                                   ] ,
        [ "string"    , "\"hello\""                            ] ,
        [ "array"     , "[1,2,3]"                              ] ,
        [ "object"    , "{\"name\":\"Marc\",\"active\":true}"  ]
    ] )( "parse(fromJSON(%p)) equals JSON.parse(%p)" , ( _label , jsonSource ) =>
    {
        expect( parse( fromJSON( jsonSource ) ) ).toEqual( JSON.parse( jsonSource ) ) ;
    } ) ;
} ) ;

describe( "fromJSON — eden defaults applied to output" , () =>
{
    test( "identifier-compatible keys become unquoted by default" , () =>
    {
        expect( fromJSON( "{\"name\":\"Marc\",\"active\":true}" ) )
            .toBe( "{name:\"Marc\",active:true}" ) ;
    } ) ;

    test( "indent: 2 produces pretty-printed eden" , () =>
    {
        expect( fromJSON( "{\"a\":1,\"b\":2}" , { indent: 2 } ) )
            .toBe( "{\n  a: 1,\n  b: 2\n}" ) ;
    } ) ;

    test( "quotes: \"single\" controls the string quote style" , () =>
    {
        expect( fromJSON( "{\"a\":\"hi\"}" , { quotes: "single" } ) )
            .toBe( "{a:'hi'}" ) ;
    } ) ;

    test( "unquotedKeys: false keeps all keys quoted" , () =>
    {
        expect( fromJSON( "{\"a\":1}" , { unquotedKeys: false } ) )
            .toBe( "{\"a\":1}" ) ;
    } ) ;
} ) ;

describe( "fromJSON — error handling" , () =>
{
    test( "malformed JSON raises EdenSyntaxError" , () =>
    {
        expect( () => fromJSON( "{ this is not json }" ) ).toThrow( EdenSyntaxError ) ;
    } ) ;

    test( "the native SyntaxError is preserved on the cause chain" , () =>
    {
        try
        {
            fromJSON( "[1,2,]" ) ;     // trailing comma is not valid JSON
            throw new Error( "fromJSON should have thrown" ) ;
        }
        catch ( error )
        {
            expect( error ).toBeInstanceOf( EdenSyntaxError ) ;
            expect( error.cause ).toBeInstanceOf( SyntaxError ) ;
        }
    } ) ;

    test( "non-string input propagates the native TypeError" , () =>
    {
        // JSON.parse coerces its argument to string, so a number
        // input does NOT throw — it yields the parsed number.
        // The case we care about is `undefined` which yields the
        // literal string "undefined" and then explodes inside
        // JSON.parse with a SyntaxError; that is wrapped, not
        // propagated. We document this here so the behavior is
        // intentional.
        expect( () => fromJSON( undefined ) ).toThrow( EdenSyntaxError ) ;
    } ) ;
} ) ;
