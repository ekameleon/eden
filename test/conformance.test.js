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

const HERE                   = dirname( fileURLToPath( import.meta.url ) ) ;
const FIXTURES_DIR           = join( HERE, "fixtures", "parse" ) ;
const STRINGIFY_FIXTURES_DIR = join( HERE, "fixtures", "stringify" ) ;
const EVAL_FIXTURES_DIR      = join( HERE, "fixtures", "eval" ) ;

/**
 * Whitelist of JavaScript globals an eval fixture can request via
 * its `$include` array. Restricted to a known set so a fixture
 * cannot pull anything unexpected from the host environment.
 */
const EVAL_GLOBALS =
{
    Array   ,
    Boolean ,
    Date    ,
    JSON    ,
    Math    ,
    Number  ,
    Object  ,
    String
} ;

/**
 * Maps the `class` string in an `.error.json` companion to the
 * corresponding eden error class. Unknown class names fall back to
 * the base `Error` so the test still fails loudly rather than
 * matching anything.
 *
 * @type {Record<string, Function>}
 */
const ERROR_CLASSES =
{
    EdenError          : eden.EdenError          ,
    EdenSyntaxError    : eden.EdenSyntaxError    ,
    EdenReferenceError : eden.EdenReferenceError ,
    EdenSecurityError  : eden.EdenSecurityError  ,
    EdenTypeError      : eden.EdenTypeError
} ;

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

/**
 * Discovers stringify fixture pairs: each `NNN-name.eden` source has
 * a matching `NNN-name.expected` text file containing the canonical
 * stringified output, and may optionally have a
 * `NNN-name.options.json` companion carrying the `StringifyOptions`
 * to pass.
 *
 * @returns {Array<{ name: string, edenPath: string, expectedPath: string, optionsPath: string, expectedExists: boolean, optionsExists: boolean }>}
 */
function discoverStringifyFixtures()
{
    if ( ! existsSync( STRINGIFY_FIXTURES_DIR ) )
    {
        return [] ;
    }

    const entries = readdirSync( STRINGIFY_FIXTURES_DIR )
        .filter( ( file ) => file.endsWith( ".eden" ) )
        .sort() ;

    return entries.map( ( file ) =>
    {
        const name         = file.slice( 0, -".eden".length ) ;
        const edenPath     = join( STRINGIFY_FIXTURES_DIR, file ) ;
        const expectedPath = join( STRINGIFY_FIXTURES_DIR, name + ".expected" ) ;
        const optionsPath  = join( STRINGIFY_FIXTURES_DIR, name + ".options.json" ) ;
        return {
            name,
            edenPath,
            expectedPath,
            optionsPath,
            expectedExists: existsSync( expectedPath ) ,
            optionsExists : existsSync( optionsPath )
        } ;
    } ) ;
}

const stringifyFixtures = discoverStringifyFixtures() ;
const hasStringify      = typeof eden.stringifyAST === "function" && typeof eden.parseToAST === "function" ;

describe( "conformance: stringify fixtures", () =>
{
    if ( ! hasStringify )
    {
        test( `${ stringifyFixtures.length } fixture(s) discovered, 0 executed (stringifyAST() or parseToAST() not yet implemented)`, () =>
        {
            console.log(
                `[conformance] stringify path is not ready — skipping ${ stringifyFixtures.length } fixture(s).`
            ) ;
            expect( hasStringify ).toBe( false ) ;
        } ) ;
        return ;
    }

    if ( stringifyFixtures.length === 0 )
    {
        test( "no fixtures found", () =>
        {
            console.log( `[conformance] no fixtures found in ${ STRINGIFY_FIXTURES_DIR }` ) ;
        } ) ;
        return ;
    }

    for ( const fixture of stringifyFixtures )
    {
        test( fixture.name, () =>
        {
            if ( ! fixture.expectedExists )
            {
                throw new Error(
                    `Fixture "${ fixture.name }" is missing its .expected companion at ${ fixture.expectedPath }`
                ) ;
            }

            const source   = readFileSync( fixture.edenPath     , "utf8" ) ;
            const expected = readFileSync( fixture.expectedPath , "utf8" ) ;
            const options  = fixture.optionsExists
                             ? JSON.parse( readFileSync( fixture.optionsPath , "utf8" ) )
                             : undefined ;

            const ast    = eden.parseToAST( source ) ;
            const actual = eden.stringifyAST( ast , options ) ;

            expect( actual ).toBe( expected ) ;
        } ) ;
    }
} ) ;

/**
 * Discovers eval fixture sets. Each fixture has a required
 * `NNN-slug.eden` source and may carry up to four companions:
 *   - `NNN-slug.scope.json`  — preloaded scope, may include a
 *                              `$include` array of allowed globals.
 *   - `NNN-slug.policy.json` — EvaluateOptions.policy.
 *   - `NNN-slug.json`        — expected result (JSON-serializable).
 *   - `NNN-slug.error.json`  — expected error class
 *                              (`{ class, messageIncludes? }`).
 *
 * Either `.json` or `.error.json` must be present.
 *
 * @returns {Array<{
 *     name: string,
 *     edenPath: string,
 *     scopePath: string,
 *     policyPath: string,
 *     jsonPath: string,
 *     errorPath: string,
 *     scopeExists: boolean,
 *     policyExists: boolean,
 *     jsonExists: boolean,
 *     errorExists: boolean
 * }>}
 */
function discoverEvalFixtures()
{
    if ( ! existsSync( EVAL_FIXTURES_DIR ) )
    {
        return [] ;
    }

    const entries = readdirSync( EVAL_FIXTURES_DIR )
        .filter( ( file ) => file.endsWith( ".eden" ) )
        .sort() ;

    return entries.map( ( file ) =>
    {
        const name       = file.slice( 0, -".eden".length ) ;
        const edenPath   = join( EVAL_FIXTURES_DIR , file ) ;
        const scopePath  = join( EVAL_FIXTURES_DIR , name + ".scope.json"  ) ;
        const policyPath = join( EVAL_FIXTURES_DIR , name + ".policy.json" ) ;
        const jsonPath   = join( EVAL_FIXTURES_DIR , name + ".json"        ) ;
        const errorPath  = join( EVAL_FIXTURES_DIR , name + ".error.json"  ) ;
        return {
            name         ,
            edenPath     ,
            scopePath    ,
            policyPath   ,
            jsonPath     ,
            errorPath    ,
            scopeExists  : existsSync( scopePath  ) ,
            policyExists : existsSync( policyPath ) ,
            jsonExists   : existsSync( jsonPath   ) ,
            errorExists  : existsSync( errorPath  )
        } ;
    } ) ;
}

/**
 * Builds the runtime scope for an eval fixture, applying the
 * `$include` whitelist if present.
 *
 * @param   {{ scopeExists: boolean, scopePath: string }} fixture
 * @returns {object}
 */
function loadEvalScope( fixture )
{
    if ( ! fixture.scopeExists )
    {
        return {} ;
    }
    const raw            = JSON.parse( readFileSync( fixture.scopePath , "utf8" ) ) ;
    const { $include = [] , ...rest } = raw ;
    const scope = { ...rest } ;
    for ( const name of $include )
    {
        if ( EVAL_GLOBALS[ name ] !== undefined )
        {
            scope[ name ] = EVAL_GLOBALS[ name ] ;
        }
    }
    return scope ;
}

/**
 * Loads the policy payload for an eval fixture.
 *
 * @param   {{ policyExists: boolean, policyPath: string }} fixture
 * @returns {object | undefined}
 */
function loadEvalPolicy( fixture )
{
    if ( ! fixture.policyExists )
    {
        return undefined ;
    }
    return JSON.parse( readFileSync( fixture.policyPath , "utf8" ) ) ;
}

const evalFixtures = discoverEvalFixtures() ;
const hasEvaluate  = typeof eden.evaluate === "function" ;

describe( "conformance: eval fixtures", () =>
{
    if ( ! hasEvaluate )
    {
        test( `${ evalFixtures.length } fixture(s) discovered, 0 executed (evaluate() not yet implemented)`, () =>
        {
            console.log(
                `[conformance] evaluate() is not exported yet — skipping ${ evalFixtures.length } fixture(s).`
            ) ;
            expect( hasEvaluate ).toBe( false ) ;
        } ) ;
        return ;
    }

    if ( evalFixtures.length === 0 )
    {
        test( "no fixtures found", () =>
        {
            console.log( `[conformance] no fixtures found in ${ EVAL_FIXTURES_DIR }` ) ;
        } ) ;
        return ;
    }

    for ( const fixture of evalFixtures )
    {
        test( fixture.name, () =>
        {
            if ( ! fixture.jsonExists && ! fixture.errorExists )
            {
                throw new Error(
                    `Fixture "${ fixture.name }" is missing both .json and .error.json companions.`
                ) ;
            }
            if ( fixture.jsonExists && fixture.errorExists )
            {
                throw new Error(
                    `Fixture "${ fixture.name }" has both .json and .error.json — pick one.`
                ) ;
            }

            const source  = readFileSync( fixture.edenPath , "utf8" ) ;
            const scope   = loadEvalScope( fixture ) ;
            const policy  = loadEvalPolicy( fixture ) ;
            const options = policy !== undefined ? { scope , policy } : { scope } ;

            if ( fixture.errorExists )
            {
                const errorSpec      = JSON.parse( readFileSync( fixture.errorPath , "utf8" ) ) ;
                const ErrorClass     = ERROR_CLASSES[ errorSpec.class ] ?? Error ;
                const messageIncludes = errorSpec.messageIncludes ;

                let thrown ;
                try
                {
                    eden.evaluate( source , options ) ;
                }
                catch ( error )
                {
                    thrown = error ;
                }
                expect( thrown ).toBeInstanceOf( ErrorClass ) ;
                if ( typeof messageIncludes === "string" )
                {
                    expect( thrown.message ).toContain( messageIncludes ) ;
                }
                return ;
            }

            const expected = JSON.parse( readFileSync( fixture.jsonPath , "utf8" ) ) ;
            const actual   = eden.evaluate( source , options ) ;
            expect( actual ).toEqual( expected ) ;
        } ) ;
    }
} ) ;
