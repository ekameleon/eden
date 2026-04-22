/**
 * @file Walks a data-mode AST node and returns its JavaScript value.
 *
 * The helper recognizes every node type producible by the parser in
 * data mode: `Literal`, `ArrayExpression`, `ObjectExpression`,
 * `Property`, `UnaryExpression`. Eval-mode-only node types (such as
 * `Identifier`, `MemberExpression`, `CallExpression`,
 * `NewExpression`, `AssignmentStatement`) should never reach this
 * walker; encountering one signals a bug and raises `EdenTypeError`.
 *
 * Duplicate object keys follow ECMAScript semantics: last
 * definition wins (SPEC.md §3.5).
 */

import EdenTypeError from "../../errors/EdenTypeError.js" ;
import NodeType      from "../ast/NodeType.js" ;

/**
 * Converts a data-mode AST node into its native JavaScript value.
 *
 * @param   {object} node
 * @returns {*}
 */
export default function evaluateDataNode( node )
{
    switch ( node.type )
    {
        case NodeType.LITERAL :
            return node.value ;

        case NodeType.ARRAY_EXPRESSION :
            return node.elements.map( ( element ) => evaluateDataNode( element ) ) ;

        case NodeType.OBJECT_EXPRESSION :
        {
            const result = {} ;
            for ( const property of node.properties )
            {
                const keyNode = property.key ;
                let keyName ;
                if ( keyNode.type === NodeType.IDENTIFIER )
                {
                    keyName = keyNode.name ;
                }
                else if ( keyNode.type === NodeType.LITERAL )
                {
                    keyName = String( keyNode.value ) ;
                }
                else
                {
                    throw new EdenTypeError(
                        `Cannot evaluate property key of type "${ keyNode.type }" in data mode.`
                    ) ;
                }
                result[ keyName ] = evaluateDataNode( property.value ) ;
            }
            return result ;
        }

        case NodeType.UNARY_EXPRESSION :
        {
            const argumentValue = evaluateDataNode( node.argument ) ;
            if ( node.operator === "-" )
            {
                if ( typeof argumentValue === "bigint" )
                {
                    return -argumentValue ;
                }
                return -argumentValue ;
            }
            return +argumentValue ;
        }

        default :
            throw new EdenTypeError(
                `Cannot evaluate AST node of type "${ node.type }" in data mode.`
            ) ;
    }
}
