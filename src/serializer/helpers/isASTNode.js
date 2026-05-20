/**
 * @file Predicate distinguishing an AST node from an ordinary
 *       JavaScript value, used by the serializer's top-level
 *       dispatch.
 *
 * The check is intentionally narrow — a plain object with a string
 * `type` field — so that ordinary JavaScript objects flow through
 * the value path even when they happen to have a `type` property
 * whose value is not a string.
 */

/**
 * Tells whether `input` looks like an AST node produced by the
 * parser.
 *
 * @param   {*} input
 * @returns {boolean}
 */
export default function isASTNode( input )
{
    return input !== null
        && typeof input === "object"
        && typeof input.type === "string" ;
}
