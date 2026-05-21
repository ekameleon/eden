/**
 * @file Bench runner: compares `eden.parse` / `eden.stringify`
 *       against the native `JSON.parse` / `JSON.stringify` on a
 *       small set of representative payloads.
 *
 * Run with:
 *
 *     bun run bench
 *
 * Output goes to stdout as a fixed-width ASCII table. Numbers are
 * machine-dependent — do not check them against thresholds and do
 * not include them in CI.
 *
 * Discovery: every `bench/cases/*.js` module is loaded dynamically
 * and expected to default-export an object of the shape:
 *
 *     {
 *         name      : string             ,
 *         json      : string             , // strict-JSON source
 *         eden      : string (optional)  , // eden source; defaults to `json`
 *         value     : *                  , // runtime value for `eden.stringify`
 *         jsonValue : * (optional)         // runtime value for `JSON.stringify`;
 *                                          // defaults to `value`. Use it when
 *                                          // `value` contains BigInt or other
 *                                          // JSON-incompatible primitives.
 *     }
 */

import { readdirSync } from "node:fs"     ;
import { join , dirname } from "node:path" ;
import { fileURLToPath }  from "node:url"  ;
import { pathToFileURL }  from "node:url"  ;

import * as eden from "../src/index.js" ;

import { bench , formatOpsPerSec , formatRatio } from "./harness.js" ;

const HERE      = dirname( fileURLToPath( import.meta.url ) ) ;
const CASES_DIR = join( HERE , "cases" ) ;

/**
 * Loads every case module in alphabetical order.
 *
 * @returns {Promise<Array<{name: string, json: string, eden?: string, value: *}>>}
 */
async function discoverCases()
{
    const files = readdirSync( CASES_DIR )
        .filter( ( f ) => f.endsWith( ".js" ) )
        .sort() ;

    const cases = [] ;
    for ( const file of files )
    {
        const url    = pathToFileURL( join( CASES_DIR , file ) ).href ;
        const mod    = await import( url ) ;
        cases.push( mod.default ) ;
    }
    return cases ;
}

/**
 * Runs the four standard benches (`parse` × {JSON, eden},
 * `stringify` × {JSON, eden}) on the supplied case definition.
 *
 * @param   {{name: string, json: string, eden?: string, value: *}} testCase
 * @returns {Array<{ op: string, opsPerSec: number, ratio: number }>}
 */
function runCase( testCase )
{
    const { json , eden: edenSource = json , value , jsonValue = value } = testCase ;

    const jsonParse    = bench( "JSON.parse"      , () => JSON.parse( json )            ) ;
    const edenParse    = bench( "eden.parse"      , () => eden.parse( edenSource )      ) ;
    const jsonStrFy    = bench( "JSON.stringify"  , () => JSON.stringify( jsonValue )   ) ;
    const edenStrFy    = bench( "eden.stringify"  , () => eden.stringify( value )       ) ;

    return [
        { op: "JSON.parse"     , opsPerSec: jsonParse.opsPerSec , ratio: 1                                            } ,
        { op: "eden.parse"     , opsPerSec: edenParse.opsPerSec , ratio: edenParse.opsPerSec / jsonParse.opsPerSec    } ,
        { op: "JSON.stringify" , opsPerSec: jsonStrFy.opsPerSec , ratio: 1                                            } ,
        { op: "eden.stringify" , opsPerSec: edenStrFy.opsPerSec , ratio: edenStrFy.opsPerSec / jsonStrFy.opsPerSec    }
    ] ;
}

/**
 * Prints a single case block.
 *
 * @param   {string}                                                  name
 * @param   {Array<{ op: string, opsPerSec: number, ratio: number }>} rows
 * @returns {void}
 */
function printCase( name , rows )
{
    const namePad = name.padEnd( 24 ) ;
    for ( let i = 0 ; i < rows.length ; i += 1 )
    {
        const { op , opsPerSec , ratio } = rows[ i ] ;
        const left = i === 0 ? namePad : "".padEnd( 24 ) ;
        console.log(
            left
            + op.padEnd( 16 )
            + formatOpsPerSec( opsPerSec )
            + "   "
            + formatRatio( ratio )
        ) ;
    }
    console.log( "─".repeat( 70 ) ) ;
}

/**
 * Entry point.
 *
 * @returns {Promise<void>}
 */
async function main()
{
    console.log( "eden vs JSON benchmarks — " + runtimeLabel() ) ;
    console.log( "" ) ;
    console.log(
        "CASE".padEnd( 24 )
        + "OP".padEnd( 16 )
        + "ops/sec".padStart( 14 )
        + "   "
        + "ratio".padStart( 7 )
    ) ;
    console.log( "─".repeat( 70 ) ) ;

    const cases = await discoverCases() ;
    for ( const testCase of cases )
    {
        const rows = runCase( testCase ) ;
        printCase( testCase.name , rows ) ;
    }

    console.log( "" ) ;
    console.log( "ratio < 1.00x  →  eden slower than JSON" ) ;
    console.log( "ratio > 1.00x  →  eden faster than JSON" ) ;
}

/**
 * Short runtime description for the output banner.
 *
 * @returns {string}
 */
function runtimeLabel()
{
    if ( typeof globalThis.Bun !== "undefined" )
    {
        return "Bun " + globalThis.Bun.version + ", " + process.platform + " " + process.arch ;
    }
    return "Node " + process.version + ", " + process.platform + " " + process.arch ;
}

main().catch( ( error ) =>
{
    console.error( error ) ;
    process.exit( 1 ) ;
} ) ;
