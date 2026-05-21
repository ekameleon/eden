/**
 * @file Medium-sized nested document (~30 leaves, 3 levels deep).
 *
 * Representative of structured records, document-store payloads, and
 * REST responses that mix scalars, sub-objects and small arrays.
 */

const value =
{
    user :
    {
        name     : "Marc"             ,
        joinedAt : "2024-01-15"       ,
        profile  :
        {
            bio    : "Maker and developer." ,
            avatar : "https://example.com/avatar.png"
        } ,
        prefs    :
        {
            theme : "dark" ,
            lang  : "fr"   ,
            notif : true
        }
    } ,
    items :
    [
        { id: 1 , qty: 2 , label: "alpha"   } ,
        { id: 2 , qty: 5 , label: "beta"    } ,
        { id: 3 , qty: 1 , label: "gamma"   } ,
        { id: 4 , qty: 7 , label: "delta"   }
    ] ,
    meta :
    {
        version   : 1                     ,
        timestamp : "2024-04-22T10:00:00Z"
    }
} ;

export default
{
    name  : "medium-nested"  ,
    json  : JSON.stringify( value ) ,
    value
} ;
