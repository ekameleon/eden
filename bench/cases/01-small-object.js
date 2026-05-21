/**
 * @file Small flat object (~5 keys, plain scalars).
 *
 * Representative of typical API payloads, config snippets, and the
 * kind of object literal a developer types out by hand.
 */

const value =
{
    name   : "Marc"                ,
    active : true                  ,
    count  : 42                    ,
    role   : "admin"               ,
    email  : "marc@ooopener.com"
} ;

export default
{
    name  : "small-object" ,
    json  : JSON.stringify( value ) ,
    eden  : "{name:\"Marc\",active:true,count:42,role:\"admin\",email:\"marc@ooopener.com\"}" ,
    value
} ;
