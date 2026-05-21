/**
 * @file Tiny zero-dependency micro-bench harness.
 *
 * `bench(name, fn, durationMs)` warms the JIT briefly, then repeatedly
 * invokes `fn` until `durationMs` have elapsed and reports the
 * resulting throughput. The harness intentionally avoids any third
 * party micro-bench library so the project keeps its zero-runtime,
 * zero-dev-bench dependency stance.
 */

const WARMUP_ITERATIONS = 100 ;

/**
 * Measures the throughput of a synchronous, side-effect-free
 * function.
 *
 * @param   {string}   name
 * @param   {() => *}  fn
 * @param   {number}  [durationMs=1000] - Steady-state measurement window.
 * @returns {{ name: string, opsPerSec: number, iter: number, elapsedMs: number }}
 */
export function bench( name , fn , durationMs = 1000 )
{
    for ( let i = 0 ; i < WARMUP_ITERATIONS ; i += 1 )
    {
        fn() ;
    }

    let iter  = 0 ;
    const start = performance.now() ;
    let now ;
    do
    {
        fn() ;
        iter += 1 ;
        now = performance.now() ;
    }
    while ( now - start < durationMs ) ;

    const elapsedMs = now - start ;
    const opsPerSec = ( iter / elapsedMs ) * 1000 ;

    return { name , opsPerSec , iter , elapsedMs } ;
}

/**
 * Formats a numeric ops/sec value with locale-aware separators and
 * fixed-width padding for nice column alignment.
 *
 * @param   {number} opsPerSec
 * @returns {string}
 */
export function formatOpsPerSec( opsPerSec )
{
    return Math.round( opsPerSec ).toLocaleString( "en-US" ).padStart( 14 ) ;
}

/**
 * Formats a ratio with three decimal places and an `x` suffix.
 *
 * @param   {number} ratio
 * @returns {string}
 */
export function formatRatio( ratio )
{
    return ( ratio.toFixed( 2 ) + "x" ).padStart( 7 ) ;
}
