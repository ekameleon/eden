/**
 * @file Enumeration of `Literal` node discriminants.
 *
 * `Literal.kind` tells consumers which source construct produced the
 * literal, which is useful to round-trip an AST back to source
 * without losing the original form (e.g. a `template` vs a `string`
 * carrying the same JS value).
 */

/**
 * Enumeration of every accepted value for `Literal.kind`.
 *
 * @type {Readonly<{
 *     NULL:      "null",
 *     UNDEFINED: "undefined",
 *     BOOLEAN:   "boolean",
 *     NUMBER:    "number",
 *     BIGINT:    "bigint",
 *     STRING:    "string",
 *     TEMPLATE:  "template"
 * }>}
 */
const LiteralKind = Object.freeze(
{
    NULL      : "null"      ,
    UNDEFINED : "undefined" ,
    BOOLEAN   : "boolean"   ,
    NUMBER    : "number"    ,
    BIGINT    : "bigint"    ,
    STRING    : "string"    ,
    TEMPLATE  : "template"
} ) ;

export default LiteralKind ;
