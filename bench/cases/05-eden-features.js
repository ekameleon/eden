/**
 * @file eden-flavoured source — unquoted keys, trailing commas, a
 *       line comment, a template literal, and a BigInt literal.
 *
 * The `json` companion is the strict-JSON equivalent (same runtime
 * value), so the bench can still compare `JSON.parse` against
 * `eden.parse` on a fair footing — the parser does more work on the
 * eden side because it has more grammar to recognize, which is
 * exactly what this case is meant to measure.
 *
 * Note: `JSON.parse` cannot read the eden source directly, hence
 * the explicit JSON twin.
 */

const value =
{
    name    : "Marc"               ,
    count   : 42                   ,
    active  : true                 ,
    tags    : [ "dev" , "maker" ]  ,
    big     : 9007199254740993n    ,
    bio     : "Line 1\nLine 2"
} ;

const edenSource =
    "{\n" +
    "    // unquoted keys, trailing comma, BigInt, template\n" +
    "    name   : \"Marc\",\n" +
    "    count  : 42,\n" +
    "    active : true,\n" +
    "    tags   : [\"dev\", \"maker\",],\n" +
    "    big    : 9007199254740993n,\n" +
    "    bio    : `Line 1\nLine 2`,\n" +
    "}" ;

/**
 * Strict-JSON twin used by `JSON.parse` / `JSON.stringify` benches.
 * `BigInt` is downgraded to a Number (loses precision but the bench
 * only cares about parse/serialize cost, not value fidelity), and
 * the template-quoted bio becomes a plain string.
 */
const jsonValue =
{
    name    : "Marc"                ,
    count   : 42                    ,
    active  : true                  ,
    tags    : [ "dev" , "maker" ]   ,
    big     : 9007199254740992      ,
    bio     : "Line 1\nLine 2"
} ;

export default
{
    name      : "eden-features"        ,
    json      : JSON.stringify( jsonValue ) ,
    eden      : edenSource             ,
    value                              ,
    jsonValue
} ;
