/**
 * @file Enumeration of AST node types produced by the parser.
 *
 * The string values follow the ESTree convention (CamelCase) so that
 * downstream tooling written against ESTree can identify eden AST
 * nodes with minimal adaptation. See ARCHITECTURE.md §4.
 */

/**
 * Enumeration of every AST node `type` produced by the parser.
 *
 * The object is frozen to prevent accidental mutation at runtime;
 * its keys are the canonical identifiers used across the codebase,
 * and its values are the string discriminators carried by each node.
 *
 * @type {Readonly<{
 *     PROGRAM:              "Program",
 *     LITERAL:              "Literal",
 *     IDENTIFIER:           "Identifier",
 *     MEMBER_EXPRESSION:    "MemberExpression",
 *     ARRAY_EXPRESSION:     "ArrayExpression",
 *     OBJECT_EXPRESSION:    "ObjectExpression",
 *     PROPERTY:             "Property",
 *     UNARY_EXPRESSION:     "UnaryExpression",
 *     CALL_EXPRESSION:      "CallExpression",
 *     NEW_EXPRESSION:       "NewExpression",
 *     ASSIGNMENT_STATEMENT: "AssignmentStatement"
 * }>}
 */
const NodeType = Object.freeze(
{
    PROGRAM:              "Program"              ,
    LITERAL:              "Literal"              ,
    IDENTIFIER:           "Identifier"           ,
    MEMBER_EXPRESSION:    "MemberExpression"     ,
    ARRAY_EXPRESSION:     "ArrayExpression"      ,
    OBJECT_EXPRESSION:    "ObjectExpression"     ,
    PROPERTY:             "Property"             ,
    UNARY_EXPRESSION:     "UnaryExpression"      ,
    CALL_EXPRESSION:      "CallExpression"       ,
    NEW_EXPRESSION:       "NewExpression"        ,
    ASSIGNMENT_STATEMENT: "AssignmentStatement"
} ) ;

export default NodeType ;
