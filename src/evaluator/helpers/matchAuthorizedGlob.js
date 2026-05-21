/**
 * @file Glob matcher for `SecurityPolicy.authorized` patterns.
 *
 * The accepted shape is intentionally minimal:
 *
 *   - an exact path, e.g. `"Date"` matches the path `"Date"` and
 *     nothing else;
 *   - a suffix wildcard, e.g. `"Math.*"` matches every path that
 *     starts with `"Math."` (one **or more** segments), so
 *     `"Math.PI"`, `"Math.sqrt"` and `"Math.subtree.fn"` all match
 *     while the bare `"Math"` does not.
 *
 * Middle-position wildcards (`"a.*.c"`) are out of scope; if a
 * future case demands them, they can be added without changing
 * the existing match semantics.
 */

/**
 * Returns `true` when `path` is matched by at least one entry in
 * `patterns`.
 *
 * @param   {string}   path
 * @param   {string[]} patterns
 * @returns {boolean}
 */
export default function matchAuthorizedGlob( path , patterns )
{
    for ( const pattern of patterns )
    {
        if ( pattern.endsWith( ".*" ) )
        {
            const prefix = pattern.slice( 0 , -2 ) ;
            if ( path === prefix )
            {
                continue ;
            }
            if ( path.startsWith( prefix + "." ) )
            {
                return true ;
            }
        }
        else if ( pattern === path )
        {
            return true ;
        }
    }
    return false ;
}
