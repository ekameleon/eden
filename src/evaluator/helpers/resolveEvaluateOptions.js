/**
 * @file Merges a user-supplied `EvaluateOptions` object with the
 *       library defaults documented in ARCHITECTURE.md §6.3.
 *
 * The returned object is always a fresh plain object: the nested
 * `policy` is shallow-merged and its `authorized` array is copied,
 * so downstream code can store the resolved options without
 * worrying about mutation by the caller.
 *
 * Note: this resolver covers the evaluator-specific surface only
 * (`scope`, `policy`). The parse-side options carried by the
 * public `evaluate()` entry point are merged separately by that
 * entry point (sub-step #7).
 */

/**
 * @typedef {object} SecurityPolicyOptions
 * @property {boolean}   [allowFunctionCall=false]
 * @property {boolean}   [allowConstructor=true]
 * @property {string[]}  [authorized] - Glob patterns of authorized paths.
 * @property {*}         [undefineable=undefined] - Fallback value when a path is denied.
 * @property {((path: string) => void) | null} [onDenied=null] - Optional hook.
 *
 * @typedef {object} EvaluateOptions
 * @property {object}                [scope={}]
 * @property {SecurityPolicyOptions} [policy]
 */

const DEFAULT_AUTHORIZED = Object.freeze(
[
    "Array"    ,
    "Boolean"  ,
    "Date"     ,
    "Error"    ,
    "Math.*"   ,
    "Number.*" ,
    "Object"   ,
    "String.*" ,
    "Infinity"
] ) ;

const DEFAULT_POLICY = Object.freeze(
{
    allowFunctionCall : false              ,
    allowConstructor  : true               ,
    authorized        : DEFAULT_AUTHORIZED ,
    undefineable      : undefined          ,
    onDenied          : null
} ) ;

/**
 * Returns a resolved `EvaluateOptions` object: every default field
 * is present, user-supplied values override defaults. The
 * `authorized` list is cloned, so subsequent mutations on the
 * returned policy never reach the defaults.
 *
 * @param   {EvaluateOptions} [input]
 * @returns {{ scope: object, policy: SecurityPolicyOptions }}
 */
export default function resolveEvaluateOptions( input )
{
    const { scope = {} , policy = {} } = input ?? {} ;
    const { authorized = DEFAULT_POLICY.authorized } = policy ;
    return {
        scope ,
        policy :
        {
            ...DEFAULT_POLICY ,
            ...policy         ,
            authorized : [ ...authorized ]
        }
    } ;
}
