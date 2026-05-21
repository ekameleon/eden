/**
 * @file Large array of ~1000 small objects.
 *
 * Stress-tests the per-element overhead of the parser and serializer
 * loops. Representative of bulk data exports and analytics payloads.
 */

const value = Array.from(
    { length: 1000 } ,
    ( _ , index ) => ( { id: index , label: "item-" + index , active: ( index % 2 ) === 0 } )
) ;

export default
{
    name  : "large-array-1000" ,
    json  : JSON.stringify( value ) ,
    value
} ;
