/**
 * @file Negative-fixture harness for the lexer.
 *
 * Auto-discovers every `.eden` file in `test/fixtures/lexer/` and
 * checks that `tokenize(<eden source>)` throws an error matching the
 * adjacent `.error.json` descriptor. The descriptor schema is
 * documented in `test/fixtures/lexer/README.md`.
 *
 * Matching rules:
 *   - `class`   : strict equality against `error.constructor.name`
 *   - `message` : case-insensitive **substring** match against `error.message`
 *   - `line`    : strict equality
 *   - `column`  : strict equality
 *   - `offset`  : strict equality
 *
 * A `.eden` file without its `.error.json` counterpart (or vice
 * versa) is reported as a fixture-authoring error.
 */

import { describe , test , expect } from "bun:test" ;
import { readdirSync , readFileSync , existsSync } from "node:fs" ;
import { join , dirname } from "node:path" ;
import { fileURLToPath } from "node:url" ;

import { tokenize } from "../src/index.js" ;

const HERE         = dirname( fileURLToPath( import.meta.url ) ) ;
const FIXTURES_DIR = join( HERE , "fixtures" , "lexer" ) ;

/**
 * Discovers fixture pairs in the lexer fixtures directory.
 *
 * @returns {Array<{ name: string, edenPath: string, jsonPath: string, jsonExists: boolean }>}
 */
function discoverFixtures()
{
    if ( !existsSync( FIXTURES_DIR ) )
    {
        return [] ;
    }

    return readdirSync( FIXTURES_DIR )
        .filter( ( file ) => file.endsWith( ".eden" ) )
        .sort()
        .map( ( file ) =>
        {
            const name     = file.slice( 0 , -".eden".length ) ;
            const edenPath = join( FIXTURES_DIR , file ) ;
            const jsonPath = join( FIXTURES_DIR , name + ".error.json" ) ;
            return {
                name ,
                edenPath ,
                jsonPath ,
                jsonExists: existsSync( jsonPath )
            } ;
        } ) ;
}

const fixtures = discoverFixtures() ;

describe( "conformance: lexer negative fixtures" , () =>
{
    if ( fixtures.length === 0 )
    {
        test( "no fixtures yet" , () =>
        {
            console.log( `[lexer-fixtures] no fixtures in ${ FIXTURES_DIR }` ) ;
        } ) ;
        return ;
    }

    for ( const fixture of fixtures )
    {
        test( fixture.name , () =>
        {
            if ( !fixture.jsonExists )
            {
                throw new Error(
                    `Fixture "${ fixture.name }" is missing its .error.json companion at ${ fixture.jsonPath }`
                ) ;
            }

            const source     = readFileSync( fixture.edenPath , "utf8" ) ;
            const descriptor = JSON.parse( readFileSync( fixture.jsonPath , "utf8" ) ) ;

            let caught = null ;
            try
            {
                tokenize( source ) ;
            }
            catch ( error )
            {
                caught = error ;
            }

            expect( caught ).not.toBeNull() ;
            expect( caught.constructor.name ).toBe( descriptor.class ) ;
            expect( caught.message.toLowerCase() ).toContain( descriptor.message.toLowerCase() ) ;
            expect( caught.line   ).toBe( descriptor.line   ) ;
            expect( caught.column ).toBe( descriptor.column ) ;
            expect( caught.offset ).toBe( descriptor.offset ) ;
        } ) ;
    }
} ) ;
