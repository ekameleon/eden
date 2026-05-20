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

describe( "stringify — objects inline (default)" , () =>
{
    test( "empty object"                         , () => { expect( stringify( {}                ) ).toBe( "{}"           ) ; } ) ;
    test( "single identifier key"                , () => { expect( stringify( { a: 1 }          ) ).toBe( "{a:1}"        ) ; } ) ;
    test( "multiple identifier keys preserve insertion order" , () =>
    {
        expect( stringify( { a: 1 , b: 2 , c: 3 } ) ).toBe( "{a:1,b:2,c:3}" ) ;
    } ) ;
    test( "nested object"                        , () => { expect( stringify( { a: { b: 1 } }    ) ).toBe( "{a:{b:1}}"   ) ; } ) ;
    test( "object inside array"                  , () => { expect( stringify( [ { a: 1 } ]       ) ).toBe( "[{a:1}]"     ) ; } ) ;
    test( "string value uses default double quotes" , () =>
    {
        expect( stringify( { a: "x" } ) ).toBe( "{a:\"x\"}" ) ;
    } ) ;
    test( "undefined value preserved by default" , () => { expect( stringify( { a: undefined }   ) ).toBe( "{a:undefined}" ) ; } ) ;
    test( "key with spaces quoted"               , () => { expect( stringify( { "key with space": 1 } ) ).toBe( "{\"key with space\":1}" ) ; } ) ;
    test( "key starting with digit quoted (except pure integer)" , () =>
    {
        expect( stringify( { "1abc": 1 } ) ).toBe( "{\"1abc\":1}" ) ;
    } ) ;
    test( "value keyword as key is quoted (null)"     , () => { expect( stringify( { "null"     : 1 } ) ).toBe( "{\"null\":1}"     ) ; } ) ;
    test( "value keyword as key is quoted (undefined)", () => { expect( stringify( { "undefined": 1 } ) ).toBe( "{\"undefined\":1}") ; } ) ;
    test( "operation keyword as key is quoted (new)"  , () => { expect( stringify( { "new"      : 1 } ) ).toBe( "{\"new\":1}"      ) ; } ) ;
    test( "ECMAScript reserved word as key is quoted" , () => { expect( stringify( { "class"    : 1 } ) ).toBe( "{\"class\":1}"    ) ; } ) ;
    test( "non-negative integer key emitted unquoted" , () =>
    {
        expect( stringify( { 0: "a" , 42: "b" } ) ).toBe( "{0:\"a\",42:\"b\"}" ) ;
    } ) ;
    test( "key with leading zero quoted" , () =>
    {
        expect( stringify( { "01": "a" } ) ).toBe( "{\"01\":\"a\"}" ) ;
    } ) ;
    test( "decimal-like key quoted" , () =>
    {
        expect( stringify( { "1.5": "a" } ) ).toBe( "{\"1.5\":\"a\"}" ) ;
    } ) ;
    test( "$ and _ identifier keys unquoted" , () =>
    {
        expect( stringify( { $foo: 1 , _bar: 2 } ) ).toBe( "{$foo:1,_bar:2}" ) ;
    } ) ;
    test( "non-ASCII identifier (café) unquoted via Unicode ID_Start" , () =>
    {
        expect( stringify( { café: 1 } ) ).toBe( "{café:1}" ) ;
    } ) ;
} ) ;

describe( "stringify — objects multi-line indented" , () =>
{
    test( "indent: 2 with one key" , () =>
    {
        expect( stringify( { a: 1 } , { indent: 2 } ) ).toBe( "{\n  a: 1\n}" ) ;
    } ) ;
    test( "indent: 2 with multiple keys, space after colon" , () =>
    {
        expect( stringify( { a: 1 , b: 2 } , { indent: 2 } ) ).toBe( "{\n  a: 1,\n  b: 2\n}" ) ;
    } ) ;
    test( "empty object stays compact under indent" , () =>
    {
        expect( stringify( {} , { indent: 2 } ) ).toBe( "{}" ) ;
    } ) ;
    test( "nested object accumulates indentation" , () =>
    {
        expect( stringify( { a: { b: 1 } } , { indent: 2 } ) ).toBe( "{\n  a: {\n    b: 1\n  }\n}" ) ;
    } ) ;
    test( "object inside indented array" , () =>
    {
        expect( stringify( [ { a: 1 } ] , { indent: 2 } ) ).toBe( "[\n  {\n    a: 1\n  }\n]" ) ;
    } ) ;
} ) ;

describe( "stringify — objects, unquotedKeys: false" , () =>
{
    test( "all identifier keys quoted with double quotes by default" , () =>
    {
        expect( stringify( { a: 1 , b: 2 } , { unquotedKeys: false } ) ).toBe( "{\"a\":1,\"b\":2}" ) ;
    } ) ;
    test( "all identifier keys quoted with single quotes when requested" , () =>
    {
        expect( stringify( { a: 1 } , { unquotedKeys: false , quotes: "single" } ) ).toBe( "{'a':1}" ) ;
    } ) ;
} ) ;

describe( "stringify — objects, sortKeys" , () =>
{
    test( "keys sorted lexicographically (value path)" , () =>
    {
        expect( stringify( { b: 1 , a: 2 , c: 3 } , { sortKeys: true } ) ).toBe( "{a:2,b:1,c:3}" ) ;
    } ) ;
    test( "numeric keys sort by string order" , () =>
    {
        expect( stringify( { 10: "a" , 2: "b" } , { sortKeys: true } ) ).toBe( "{10:\"a\",2:\"b\"}" ) ;
    } ) ;
} ) ;

describe( "stringify — objects, trailingCommas" , () =>
{
    test( "trailingCommas ignored in inline form" , () =>
    {
        expect( stringify( { a: 1 , b: 2 } , { trailingCommas: true } ) ).toBe( "{a:1,b:2}" ) ;
    } ) ;
    test( "trailingCommas applied in multi-line form" , () =>
    {
        expect( stringify( { a: 1 , b: 2 } , { indent: 2 , trailingCommas: true } ) ).toBe( "{\n  a: 1,\n  b: 2,\n}" ) ;
    } ) ;
    test( "trailingCommas suppressed under jsonCompatible" , () =>
    {
        expect( stringify( { a: 1 , b: 2 } , { indent: 2 , trailingCommas: true , jsonCompatible: true } ) ).toBe(
            "{\n  \"a\": 1,\n  \"b\": 2\n}"
        ) ;
    } ) ;
} ) ;

describe( "stringify — objects, jsonCompatible" , () =>
{
    test( "all keys quoted with double quotes" , () =>
    {
        expect( stringify( { a: 1 , 0: "x" } , { jsonCompatible: true } ) ).toBe( "{\"0\":\"x\",\"a\":1}" ) ;
    } ) ;
    test( "undefined value dropped" , () =>
    {
        expect( stringify( { a: 1 , b: undefined , c: 2 } , { jsonCompatible: true } ) ).toBe( "{\"a\":1,\"c\":2}" ) ;
    } ) ;
    test( "NaN value collapses to null" , () =>
    {
        expect( stringify( { a: Number.NaN } , { jsonCompatible: true } ) ).toBe( "{\"a\":null}" ) ;
    } ) ;
    test( "BigInt value still throws" , () =>
    {
        expect( () => stringify( { a: 1n } , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
    test( "JSON.parse round-trip preserves value" , () =>
    {
        const original = { a: 1 , b: "hi" , nested: { c: [ 1 , 2 , null ] } } ;
        const encoded  = stringify( original , { jsonCompatible: true , indent: 2 } ) ;
        expect( JSON.parse( encoded ) ).toEqual( original ) ;
    } ) ;
} ) ;

describe( "stringifyAST — ObjectExpression" , () =>
{
    test.each(
    [
        [ "{}"                              ] ,
        [ "{a:1}"                           ] ,
        [ "{a:1,b:2}"                       ] ,
        [ "{0:\"x\"}"                       ] ,
        [ "{0xFF:1}"                        ] ,
        [ "{a:{b:[1,2]}}"                   ]
    ] )( "round trip of %p preserves inline form and raw lexemes" , ( source ) =>
    {
        const program = parseToAST( source ) ;
        expect( stringifyAST( program ) ).toBe( source ) ;
    } ) ;

    test( "string-quoted key kept under unquotedKeys (option B, fidelity)" , () =>
    {
        const program = parseToAST( "{\"foo\":1}" ) ;
        expect( stringifyAST( program ) ).toBe( "{\"foo\":1}" ) ;
    } ) ;

    test( "string-quoted key recomputed when quote style mismatches" , () =>
    {
        const program = parseToAST( "{'foo':1}" ) ;
        expect( stringifyAST( program ) ).toBe( "{\"foo\":1}" ) ;
    } ) ;

    test( "Identifier key forced into quoted form under unquotedKeys: false" , () =>
    {
        const program = parseToAST( "{a:1}" ) ;
        expect( stringifyAST( program , { unquotedKeys: false } ) ).toBe( "{\"a\":1}" ) ;
    } ) ;

    test( "ObjectExpression sortKeys reorders properties" , () =>
    {
        const program = parseToAST( "{b:1,a:2}" ) ;
        expect( stringifyAST( program , { sortKeys: true } ) ).toBe( "{a:2,b:1}" ) ;
    } ) ;

    test( "ObjectExpression jsonCompatible drops Literal undefined values" , () =>
    {
        const program = parseToAST( "{a:1,b:undefined,c:3}" ) ;
        expect( stringifyAST( program , { jsonCompatible: true } ) ).toBe( "{\"a\":1,\"c\":3}" ) ;
    } ) ;

    test( "ObjectExpression indented at top level" , () =>
    {
        const program = parseToAST( "{a:1,b:2}" ) ;
        expect( stringifyAST( program , { indent: 2 } ) ).toBe( "{\n  a: 1,\n  b: 2\n}" ) ;
    } ) ;

    test( "Number key preserves hex raw under defaults" , () =>
    {
        const program = parseToAST( "{0xFF:1}" ) ;
        expect( stringifyAST( program ) ).toBe( "{0xFF:1}" ) ;
    } ) ;

    test( "Number key recomputed to decimal under jsonCompatible" , () =>
    {
        const program = parseToAST( "{0xFF:1}" ) ;
        expect( stringifyAST( program , { jsonCompatible: true } ) ).toBe( "{\"255\":1}" ) ;
    } ) ;

    test( "Property shorthand under jsonCompatible throws EdenTypeError" , () =>
    {
        const node =
        {
            type       : NodeType.OBJECT_EXPRESSION ,
            properties :
            [
                {
                    type      : "Property" ,
                    key       : { type: NodeType.IDENTIFIER , name: "x" } ,
                    value     : { type: NodeType.IDENTIFIER , name: "x" } ,
                    shorthand : true ,
                    computed  : false
                }
            ]
        } ;
        expect( () => stringifyAST( node , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "Property computed under jsonCompatible throws EdenTypeError" , () =>
    {
        const node =
        {
            type       : NodeType.OBJECT_EXPRESSION ,
            properties :
            [
                {
                    type      : "Property" ,
                    key       : { type: NodeType.IDENTIFIER , name: "x" } ,
                    value     : { type: NodeType.LITERAL , value: 1 , kind: LiteralKind.NUMBER } ,
                    shorthand : false ,
                    computed  : true
                }
            ]
        } ;
        expect( () => stringifyAST( node , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringify — arrays inline (default)" , () =>
{
    test( "empty array"                       , () => { expect( stringify( []                  ) ).toBe( "[]"                ) ; } ) ;
    test( "single number element"             , () => { expect( stringify( [ 1 ]               ) ).toBe( "[1]"               ) ; } ) ;
    test( "multiple numbers"                  , () => { expect( stringify( [ 1 , 2 , 3 ]       ) ).toBe( "[1,2,3]"           ) ; } ) ;
    test( "mixed scalar types"                , () => { expect( stringify( [ null , true , 42 , "x" ] ) ).toBe( "[null,true,42,\"x\"]" ) ; } ) ;
    test( "undefined element preserved"       , () => { expect( stringify( [ 1 , undefined , 3 ] ) ).toBe( "[1,undefined,3]" ) ; } ) ;
    test( "nested arrays"                     , () => { expect( stringify( [ [ 1 , 2 ] , [ 3 ] ] ) ).toBe( "[[1,2],[3]]"     ) ; } ) ;
    test( "deeply nested arrays"              , () => { expect( stringify( [ [ [ 1 ] ] ]         ) ).toBe( "[[[1]]]"          ) ; } ) ;
    test( "array of strings uses double quotes by default" , () =>
    {
        expect( stringify( [ "a" , "b" ] ) ).toBe( "[\"a\",\"b\"]" ) ;
    } ) ;
    test( "array of bigints" , () =>
    {
        expect( stringify( [ 1n , 2n ] ) ).toBe( "[1n,2n]" ) ;
    } ) ;
} ) ;

describe( "stringify — arrays multi-line indented" , () =>
{
    test( "indent: 2 with 3 elements" , () =>
    {
        expect( stringify( [ 1 , 2 , 3 ] , { indent: 2 } ) ).toBe( "[\n  1,\n  2,\n  3\n]" ) ;
    } ) ;

    test( "indent: 4 with 2 elements" , () =>
    {
        expect( stringify( [ true , false ] , { indent: 4 } ) ).toBe( "[\n    true,\n    false\n]" ) ;
    } ) ;

    test( "indent: \"\\t\" uses tab unit" , () =>
    {
        expect( stringify( [ 1 , 2 ] , { indent: "\t" } ) ).toBe( "[\n\t1,\n\t2\n]" ) ;
    } ) ;

    test( "indent number clamped to 10 spaces" , () =>
    {
        expect( stringify( [ 1 ] , { indent: 999 } ) ).toBe( "[\n          1\n]" ) ;
    } ) ;

    test( "indent string truncated to 10 characters" , () =>
    {
        expect( stringify( [ 1 ] , { indent: "==========extra" } ) ).toBe( "[\n==========1\n]" ) ;
    } ) ;

    test( "empty array stays compact even when indenting" , () =>
    {
        expect( stringify( [] , { indent: 2 } ) ).toBe( "[]" ) ;
    } ) ;

    test( "nested arrays accumulate indentation" , () =>
    {
        expect( stringify( [ [ 1 , 2 ] , [ 3 ] ] , { indent: 2 } ) ).toBe(
            "[\n  [\n    1,\n    2\n  ],\n  [\n    3\n  ]\n]"
        ) ;
    } ) ;
} ) ;

describe( "stringify — arrays, trailingCommas" , () =>
{
    test( "trailingCommas ignored in inline form" , () =>
    {
        expect( stringify( [ 1 , 2 , 3 ] , { trailingCommas: true } ) ).toBe( "[1,2,3]" ) ;
    } ) ;

    test( "trailingCommas applied in multi-line form" , () =>
    {
        expect( stringify( [ 1 , 2 , 3 ] , { indent: 2 , trailingCommas: true } ) ).toBe(
            "[\n  1,\n  2,\n  3,\n]"
        ) ;
    } ) ;

    test( "trailingCommas ignored under jsonCompatible even when indented" , () =>
    {
        expect( stringify( [ 1 , 2 ] , { indent: 2 , trailingCommas: true , jsonCompatible: true } ) ).toBe(
            "[\n  1,\n  2\n]"
        ) ;
    } ) ;
} ) ;

describe( "stringify — arrays, jsonCompatible" , () =>
{
    test( "undefined element replaced by null" , () =>
    {
        expect( stringify( [ 1 , undefined , 3 ] , { jsonCompatible: true } ) ).toBe( "[1,null,3]" ) ;
    } ) ;

    test( "NaN and Infinity replaced by null" , () =>
    {
        expect( stringify( [ Number.NaN , Number.POSITIVE_INFINITY , Number.NEGATIVE_INFINITY ] , { jsonCompatible: true } ) ).toBe( "[null,null,null]" ) ;
    } ) ;

    test( "BigInt in array still throws under jsonCompatible" , () =>
    {
        expect( () => stringify( [ 1n ] , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;

    test( "output is parseable by JSON.parse" , () =>
    {
        const original = [ 1 , "hi" , null , true , [ 2 , 3 ] ] ;
        const encoded  = stringify( original , { jsonCompatible: true , indent: 2 } ) ;
        expect( JSON.parse( encoded ) ).toEqual( original ) ;
    } ) ;
} ) ;

describe( "stringifyAST — ArrayExpression" , () =>
{
    test.each(
    [
        [ "[]"                  ] ,
        [ "[1]"                 ] ,
        [ "[1,2,3]"             ] ,
        [ "[true,false,null]"   ] ,
        [ "[[1,2],[3]]"         ] ,
        [ "[0xFF,1_000n]"       ]
    ] )( "round trip of %p preserves inline form and raw lexemes" , ( source ) =>
    {
        const program = parseToAST( source ) ;
        expect( stringifyAST( program ) ).toBe( source ) ;
    } ) ;

    test( "ArrayExpression with raw-bearing string elements preserved" , () =>
    {
        const program = parseToAST( "['hello',\"world\"]" ) ;
        expect( stringifyAST( program ) ).toBe( "[\"hello\",\"world\"]" ) ;
    } ) ;

    test( "ArrayExpression indented at top level" , () =>
    {
        const program = parseToAST( "[1,2,3]" ) ;
        expect( stringifyAST( program , { indent: 2 } ) ).toBe( "[\n  1,\n  2,\n  3\n]" ) ;
    } ) ;

    test( "Nested ArrayExpression accumulates indentation" , () =>
    {
        const program = parseToAST( "[[1,2],[3]]" ) ;
        expect( stringifyAST( program , { indent: 2 } ) ).toBe(
            "[\n  [\n    1,\n    2\n  ],\n  [\n    3\n  ]\n]"
        ) ;
    } ) ;

    test( "Constructed ArrayExpression without raw on children" , () =>
    {
        const node =
        {
            type     : NodeType.ARRAY_EXPRESSION ,
            elements :
            [
                { type: NodeType.LITERAL , value: 1    , kind: LiteralKind.NUMBER  } ,
                { type: NodeType.LITERAL , value: true , kind: LiteralKind.BOOLEAN }
            ]
        } ;
        expect( stringifyAST( node ) ).toBe( "[1,true]" ) ;
    } ) ;
} ) ;

describe( "stringify — strings, double quotes (default)" , () =>
{
    test.each(
    [
        [ ""                    , "\"\""                       ] ,
        [ "hello"               , "\"hello\""                  ] ,
        [ "don't"               , "\"don't\""                  ] ,
        [ "say \"hi\""          , "\"say \\\"hi\\\"\""         ] ,
        [ "back\\slash"         , "\"back\\\\slash\""          ] ,
        [ "tab\there"           , "\"tab\\there\""             ] ,
        [ "new\nline"           , "\"new\\nline\""             ] ,
        [ "ret\rurn"            , "\"ret\\rurn\""              ] ,
        [ "\b\f\v"              , "\"\\b\\f\\v\""              ]
    ] )( "stringify(%p) → %p" , ( input , expected ) =>
    {
        expect( stringify( input ) ).toBe( expected ) ;
    } ) ;

    test( "control U+0001 escaped as \\u0001" , () =>
    {
        expect( stringify( "" ) ).toBe( "\"\\u0001\"" ) ;
    } ) ;

    test( "U+2028 escaped as \\u2028" , () =>
    {
        expect( stringify( " " ) ).toBe( "\"\\u2028\"" ) ;
    } ) ;

    test( "U+2029 escaped as \\u2029" , () =>
    {
        expect( stringify( " " ) ).toBe( "\"\\u2029\"" ) ;
    } ) ;

    test( "NUL alone escaped as \\0" , () =>
    {
        expect( stringify( " " ) ).toBe( "\"\\0\"" ) ;
    } ) ;

    test( "NUL followed by a digit escaped as \\x00 to disambiguate" , () =>
    {
        expect( stringify( " " + "7" ) ).toBe( "\"\\x007\"" ) ;
    } ) ;

    test( "back-tick is not escaped inside double quotes" , () =>
    {
        expect( stringify( "`code`" ) ).toBe( "\"`code`\"" ) ;
    } ) ;

    test( "non-ASCII passes through verbatim" , () =>
    {
        expect( stringify( "café" ) ).toBe( "\"café\"" ) ;
    } ) ;

    test( "astral character passes through verbatim" , () =>
    {
        expect( stringify( "😀" ) ).toBe( "\"😀\"" ) ;
    } ) ;
} ) ;

describe( "stringify — strings, single quotes" , () =>
{
    test( "double quote not escaped inside single quotes" , () =>
    {
        expect( stringify( "say \"hi\"" , { quotes: "single" } ) ).toBe( "'say \"hi\"'" ) ;
    } ) ;

    test( "single quote escaped inside single quotes" , () =>
    {
        expect( stringify( "don't" , { quotes: "single" } ) ).toBe( "'don\\'t'" ) ;
    } ) ;

    test( "back-tick not escaped inside single quotes" , () =>
    {
        expect( stringify( "`x`" , { quotes: "single" } ) ).toBe( "'`x`'" ) ;
    } ) ;
} ) ;

describe( "stringify — strings, jsonCompatible" , () =>
{
    test( "always double-quoted regardless of options.quotes" , () =>
    {
        expect( stringify( "hi" , { jsonCompatible: true , quotes: "single" } ) ).toBe( "\"hi\"" ) ;
    } ) ;

    test( "U+2028 passes through verbatim" , () =>
    {
        expect( stringify( " " , { jsonCompatible: true } ) ).toBe( "\" \"" ) ;
    } ) ;

    test( "U+0000 escaped as \\u0000 (no \\0 short form in JSON)" , () =>
    {
        expect( stringify( " " , { jsonCompatible: true } ) ).toBe( "\"\\u0000\"" ) ;
    } ) ;

    test( "U+000B falls back to \\u000b (no \\v in JSON)" , () =>
    {
        expect( stringify( "\v" , { jsonCompatible: true } ) ).toBe( "\"\\u000b\"" ) ;
    } ) ;

    test( "output is parseable by JSON.parse" , () =>
    {
        const original = "hello\nworld\t\"quoted\"\\backslash" ;
        const encoded  = stringify( original , { jsonCompatible: true } ) ;
        expect( JSON.parse( encoded ) ).toBe( original ) ;
    } ) ;
} ) ;

describe( "stringifyAST — Literal string raw preservation" , () =>
{
    test.each(
    [
        [ "\"hello\""             ] ,
        [ "\"say \\\"hi\\\"\""    ] ,
        [ "\"a\\nb\""             ] ,
        [ "\"\\u00E9\""           ]
    ] )( "round trip of %p preserves raw" , ( source ) =>
    {
        const program = parseToAST( source ) ;
        expect( stringifyAST( program ) ).toBe( source ) ;
    } ) ;

    test( "single-quoted source preserved when quotes:\"single\"" , () =>
    {
        const program = parseToAST( "'hello'" ) ;
        expect( stringifyAST( program , { quotes: "single" } ) ).toBe( "'hello'" ) ;
    } ) ;

    test( "single-quoted source recomputed under default options" , () =>
    {
        const program = parseToAST( "'hello'" ) ;
        expect( stringifyAST( program ) ).toBe( "\"hello\"" ) ;
    } ) ;

    test( "double-quoted source recomputed under quotes:\"single\"" , () =>
    {
        const program = parseToAST( "\"hello\"" ) ;
        expect( stringifyAST( program , { quotes: "single" } ) ).toBe( "'hello'" ) ;
    } ) ;

    test( "jsonCompatible always recomputes to JSON form" , () =>
    {
        const program = parseToAST( "'hel\\nlo'" ) ;
        expect( stringifyAST( program , { jsonCompatible: true } ) ).toBe( "\"hel\\nlo\"" ) ;
    } ) ;

    test( "Literal string node without raw uses quoteString" , () =>
    {
        const node =
        {
            type  : NodeType.LITERAL    ,
            value : "abc"               ,
            kind  : LiteralKind.STRING
        } ;
        expect( stringifyAST( node ) ).toBe( "\"abc\"" ) ;
    } ) ;
} ) ;

describe( "stringifyAST — Literal template" , () =>
{
    test( "single-line template raw preserved" , () =>
    {
        const program = parseToAST( "`hello`" ) ;
        expect( stringifyAST( program ) ).toBe( "`hello`" ) ;
    } ) ;

    test( "multi-line template raw preserved" , () =>
    {
        const source  = "`line1\nline2`" ;
        const program = parseToAST( source ) ;
        expect( stringifyAST( program ) ).toBe( source ) ;
    } ) ;

    test( "template with ${...} passthrough preserved" , () =>
    {
        const source  = "`hello ${name}`" ;
        const program = parseToAST( source ) ;
        expect( stringifyAST( program ) ).toBe( source ) ;
    } ) ;

    test( "template downgraded to JSON string under jsonCompatible" , () =>
    {
        const program = parseToAST( "`hello\nworld`" ) ;
        expect( stringifyAST( program , { jsonCompatible: true } ) ).toBe( "\"hello\\nworld\"" ) ;
    } ) ;

    test( "Literal template node without raw uses quoteTemplate" , () =>
    {
        const node =
        {
            type  : NodeType.LITERAL      ,
            value : "hello\nworld"        ,
            kind  : LiteralKind.TEMPLATE
        } ;
        expect( stringifyAST( node ) ).toBe( "`hello\nworld`" ) ;
    } ) ;

    test( "Literal template node with embedded back-tick is escaped" , () =>
    {
        const node =
        {
            type  : NodeType.LITERAL      ,
            value : "a`b"                 ,
            kind  : LiteralKind.TEMPLATE
        } ;
        expect( stringifyAST( node ) ).toBe( "`a\\`b`" ) ;
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

    test( "unknown AST node type throws EdenTypeError" , () =>
    {
        const forgedNode = { type: "FakeNodeType" } ;
        expect( () => stringifyAST( forgedNode ) ).toThrow( EdenTypeError ) ;
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

describe( "stringifyAST — UnaryExpression" , () =>
{
    test.each(
    [
        [ "-1"        ] ,
        [ "+1"        ] ,
        [ "-1.5"      ] ,
        [ "-1e10"     ] ,
        [ "-Infinity" ] ,
        [ "+Infinity" ] ,
        [ "-NaN"      ] ,
        [ "-1n"       ] ,
        [ "+1n"       ] ,
        [ "-9007199254740993n" ] ,
        [ "-1_000n"   ] ,
        [ "-0xFF"     ] ,
        [ "+0o17"     ] ,
        [ "-0b1010"   ]
    ] )( "round trip of %p preserves operator and argument raw" , ( source ) =>
    {
        const program = parseToAST( source ) ;
        expect( stringifyAST( program ) ).toBe( source ) ;
    } ) ;

    test( "indent does not break a unary scalar onto a new line" , () =>
    {
        const program = parseToAST( "-1" ) ;
        expect( stringifyAST( program , { indent: 2 } ) ).toBe( "-1" ) ;
    } ) ;

    test( "constructed UnaryExpression without raw uses recomputed argument" , () =>
    {
        const node =
        {
            type     : NodeType.UNARY_EXPRESSION ,
            operator : "-" ,
            argument : { type: NodeType.LITERAL , value: 5 , kind: LiteralKind.NUMBER }
        } ;
        expect( stringifyAST( node ) ).toBe( "-5" ) ;
    } ) ;
} ) ;

describe( "stringifyAST — UnaryExpression under jsonCompatible" , () =>
{
    test( "-Infinity collapses to null"          , () => { expect( stringifyAST( parseToAST( "-Infinity" ) , { jsonCompatible: true } ) ).toBe( "null" ) ; } ) ;
    test( "+Infinity collapses to null"          , () => { expect( stringifyAST( parseToAST( "+Infinity" ) , { jsonCompatible: true } ) ).toBe( "null" ) ; } ) ;
    test( "-NaN collapses to null"               , () => { expect( stringifyAST( parseToAST( "-NaN"      ) , { jsonCompatible: true } ) ).toBe( "null" ) ; } ) ;
    test( "-1 remains -1"                        , () => { expect( stringifyAST( parseToAST( "-1"        ) , { jsonCompatible: true } ) ).toBe( "-1"   ) ; } ) ;
    test( "-1.5 remains -1.5"                    , () => { expect( stringifyAST( parseToAST( "-1.5"      ) , { jsonCompatible: true } ) ).toBe( "-1.5" ) ; } ) ;
    test( "-0xFF normalized to -255"             , () => { expect( stringifyAST( parseToAST( "-0xFF"     ) , { jsonCompatible: true } ) ).toBe( "-255" ) ; } ) ;
    test( "-1n raises EdenTypeError"             , () =>
    {
        expect( () => stringifyAST( parseToAST( "-1n" ) , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

/**
 * Convenience helper — parses an eval-mode source so the resulting
 * tests stay short.
 *
 * @param   {string} source
 * @returns {object}
 */
function evalAST( source )
{
    return parseToAST( source , { mode: ProgramMode.EVAL } ) ;
}

describe( "stringifyAST — Identifier" , () =>
{
    test.each(
    [
        [ "foo"  ] ,
        [ "$bar" ] ,
        [ "_baz" ] ,
        [ "café" ]
    ] )( "round trip of identifier %p" , ( source ) =>
    {
        expect( stringifyAST( evalAST( source ) ) ).toBe( source ) ;
    } ) ;

    test( "Identifier under jsonCompatible throws" , () =>
    {
        expect( () => stringifyAST( evalAST( "foo" ) , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringifyAST — MemberExpression" , () =>
{
    test.each(
    [
        [ "a.b"                ] ,
        [ "a.b.c"              ] ,
        [ "obj.method"         ] ,
        [ "a[0]"               ] ,
        [ "a[42]"              ] ,
        [ "a[0xFF]"            ] ,
        [ "a[\"key\"]"         ] ,
        [ "a[\"key with space\"]" ] ,
        [ "obj.method.field"   ]
    ] )( "round trip of %p" , ( source ) =>
    {
        expect( stringifyAST( evalAST( source ) ) ).toBe( source ) ;
    } ) ;

    test( "MemberExpression under jsonCompatible throws" , () =>
    {
        expect( () => stringifyAST( evalAST( "a.b" ) , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringifyAST — CallExpression" , () =>
{
    test.each(
    [
        [ "foo()"          ] ,
        [ "foo(1)"         ] ,
        [ "foo(1,2,3)"     ] ,
        [ "obj.method(x)"  ] ,
        [ "obj.method(1,\"hi\",true)" ]
    ] )( "round trip of %p (compact)" , ( source ) =>
    {
        expect( stringifyAST( evalAST( source ) ) ).toBe( source ) ;
    } ) ;

    test( "indented mode adds space after argument commas" , () =>
    {
        expect( stringifyAST( evalAST( "foo(1,2,3)" ) , { indent: 2 } ) ).toBe( "foo(1, 2, 3)" ) ;
    } ) ;

    test( "CallExpression under jsonCompatible throws" , () =>
    {
        expect( () => stringifyAST( evalAST( "foo()" ) , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringifyAST — NewExpression" , () =>
{
    test( "without args (no parens in source) → parenless form" , () =>
    {
        expect( stringifyAST( evalAST( "new Date" ) ) ).toBe( "new Date" ) ;
    } ) ;

    test( "without args (empty parens in source) → parenless form (normalization)" , () =>
    {
        expect( stringifyAST( evalAST( "new Date()" ) ) ).toBe( "new Date" ) ;
    } ) ;

    test( "with one arg" , () =>
    {
        expect( stringifyAST( evalAST( "new Date(\"2024-01-15\")" ) ) ).toBe( "new Date(\"2024-01-15\")" ) ;
    } ) ;

    test( "with several args" , () =>
    {
        expect( stringifyAST( evalAST( "new Foo(1,2,3)" ) ) ).toBe( "new Foo(1,2,3)" ) ;
    } ) ;

    test( "with dotted callee" , () =>
    {
        expect( stringifyAST( evalAST( "new Mod.Sub(1)" ) ) ).toBe( "new Mod.Sub(1)" ) ;
    } ) ;

    test( "NewExpression under jsonCompatible throws" , () =>
    {
        expect( () => stringifyAST( evalAST( "new Date" ) , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringifyAST — AssignmentStatement" , () =>
{
    test( "simple identifier target" , () =>
    {
        expect( stringifyAST( evalAST( "a = 1" ) ) ).toBe( "a = 1" ) ;
    } ) ;

    test( "member expression target" , () =>
    {
        expect( stringifyAST( evalAST( "obj.x = \"hi\"" ) ) ).toBe( "obj.x = \"hi\"" ) ;
    } ) ;

    test( "deep member target with object value" , () =>
    {
        expect( stringifyAST( evalAST( "a.b.c = {x:1}" ) ) ).toBe( "a.b.c = {x:1}" ) ;
    } ) ;

    test( "assignment with constructor call value" , () =>
    {
        expect( stringifyAST( evalAST( "user.joined = new Date(\"2024-01-15\")" ) ) ).toBe( "user.joined = new Date(\"2024-01-15\")" ) ;
    } ) ;

    test( "spaces around `=` kept even in compact mode" , () =>
    {
        expect( stringifyAST( evalAST( "a=1" ) ) ).toBe( "a = 1" ) ;
    } ) ;

    test( "AssignmentStatement under jsonCompatible throws" , () =>
    {
        expect( () => stringifyAST( evalAST( "a = 1" ) , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringifyAST — Program eval-mode multi-statement" , () =>
{
    test( "two assignments joined by `;` in compact mode" , () =>
    {
        expect( stringifyAST( evalAST( "a = 1; b = 2" ) ) ).toBe( "a = 1;b = 2" ) ;
    } ) ;

    test( "two assignments joined by newline in indented mode" , () =>
    {
        expect( stringifyAST( evalAST( "a = 1; b = 2" ) , { indent: 2 } ) ).toBe( "a = 1\nb = 2" ) ;
    } ) ;

    test( "assignment then expression statement" , () =>
    {
        expect( stringifyAST( evalAST( "user = {name:\"Marc\"}; user.name" ) ) ).toBe( "user = {name:\"Marc\"};user.name" ) ;
    } ) ;

    test( "Program eval body empty serializes to empty string" , () =>
    {
        const node = { type: NodeType.PROGRAM , mode: ProgramMode.EVAL , body: [] } ;
        expect( stringifyAST( node ) ).toBe( "" ) ;
    } ) ;

    test( "Program eval under jsonCompatible throws" , () =>
    {
        expect( () => stringifyAST( evalAST( "a = 1" ) , { jsonCompatible: true } ) ).toThrow( EdenTypeError ) ;
    } ) ;
} ) ;

describe( "stringifyAST — Property shorthand and computed" , () =>
{
    test( "shorthand property round trip" , () =>
    {
        expect( stringifyAST( evalAST( "{foo}" ) ) ).toBe( "{foo}" ) ;
    } ) ;

    test( "shorthand mixed with longhand" , () =>
    {
        expect( stringifyAST( evalAST( "{a, b:2, c}" ) ) ).toBe( "{a,b:2,c}" ) ;
    } ) ;

    test( "computed key with identifier expression" , () =>
    {
        expect( stringifyAST( evalAST( "{[foo]:1}" ) ) ).toBe( "{[foo]:1}" ) ;
    } ) ;

    test( "computed key with member expression" , () =>
    {
        expect( stringifyAST( evalAST( "{[obj.key]:1}" ) ) ).toBe( "{[obj.key]:1}" ) ;
    } ) ;
} ) ;
