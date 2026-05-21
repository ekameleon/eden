/**
 * @file Single long string (~5 KB) wrapped in a tiny object.
 *
 * Stress-tests the string-escape path of the serializer and the
 * string-literal path of the lexer. The content is plain ASCII with
 * a handful of escapes so the workload exercises the escape table
 * rather than the verbatim-passthrough branch.
 */

const filler = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " ;
const text   = filler.repeat( 90 ) + "\nLine break.\n\tTab.\n\"Quote\".\n" ;

const value  =
{
    payload : text
} ;

export default
{
    name  : "long-string" ,
    json  : JSON.stringify( value ) ,
    value
} ;
