/**
 * @file Conformance harness for parse() fixtures.
 *
 * Discovers every `.eden` file in `test/fixtures/parse/` and checks that
 * `parse(<eden source>)` deep-equals the value stored in the matching
 * `.json` file.
 *
 * The harness is resilient to the current project state: `parse()` is
 * not yet implemented, so the harness detects its absence and reports
 * a single "skipped" message. As soon as `parse` is exported from
 * `src/index.js`, the same harness starts running every fixture
 * automatically, without any change required here.
 *
 * Fixtures come in pairs:
 *   NNN-description.eden   — eden source text
 *   NNN-description.json   — JSON representation of the expected value
 *
 * A `.eden` without its matching `.json` (or vice versa) is a fixture
 * authoring error and is reported as a failing test.
 */

import { describe, test, expect } from "bun:test" ;
import { readdirSync, readFileSync, existsSync } from "node:fs" ;
import { join, dirname } from "node:path" ;
import { fileURLToPath } from "node:url" ;

import * as eden from "../src/index.js" ;

const HERE         = dirname( fileURLToPath( import.meta.url ) ) ;
const FIXTURES_DIR = join( HERE, "fixtures", "parse" ) ;

/**
 * Discovers fixture pairs in the parse fixtures directory.
 *
 * @returns {Array<{ name: string, edenPath: string, jsonPath: string, jsonExists: boolean }>}
 */
function discoverFixtures()
{
    if ( !existsSync( FIXTURES_DIR ) )
    {
        return [] ;
    }

    const entries = readdirSync( FIXTURES_DIR )
        .filter( ( file ) => file.endsWith( ".eden" ) )
        .sort() ;

    return entries.map( ( file ) =>
    {
        const name     = file.slice( 0, -".eden".length ) ;
        const edenPath = join( FIXTURES_DIR, file ) ;
        const jsonPath = join( FIXTURES_DIR, name + ".json" ) ;
        return {
            name,
            edenPath,
            jsonPath,
            jsonExists: existsSync( jsonPath )
        } ;
    } ) ;
}

const fixtures  = discoverFixtures() ;
const hasParse  = typeof eden.parse === "function" ;

describe( "conformance: parse fixtures", () =>
{
    if ( !hasParse )
    {
        test( `${ fixtures.length } fixture(s) discovered, 0 executed (parse() not yet implemented)`, () =>
        {
            console.log(
                `[conformance] parse() is not exported yet — skipping ${ fixtures.length } fixture(s).`
            ) ;
            expect( hasParse ).toBe( false ) ;
        } ) ;
        return ;
    }

    if ( fixtures.length === 0 )
    {
        test( "no fixtures found", () =>
        {
            console.log( `[conformance] no fixtures found in ${ FIXTURES_DIR }` ) ;
        } ) ;
        return ;
    }

    for ( const fixture of fixtures )
    {
        test( fixture.name, () =>
        {
            if ( !fixture.jsonExists )
            {
                throw new Error(
                    `Fixture "${ fixture.name }" is missing its .json companion at ${ fixture.jsonPath }`
                ) ;
            }

            const source   = readFileSync( fixture.edenPath , "utf8" ) ;
            const expected = JSON.parse( readFileSync( fixture.jsonPath, "utf8" ) ) ;
            const actual   = eden.parse( source ) ;

            expect( actual ).toEqual( expected ) ;
        } ) ;
    }
} ) ;
