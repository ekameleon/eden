/**
 * @file ECMAScript 2022 reserved words that the lexer **rejects** as
 *       identifiers, per SPEC §2.6.
 *
 * eden treats every reserved word from ES2022 (strict-mode and
 * contextual variants included) as forbidden so that later grammar
 * additions cannot conflict with existing user identifiers. Words
 * that eden itself uses (`null`, `true`, `false`, `new`) are
 * deliberately absent from this set — they are classified as
 * `TokenType.KEYWORD` by the dedicated eden keyword sets.
 */

/**
 * ECMAScript reserved words forbidden as eden identifiers. A match
 * raises `EdenSyntaxError` at the start position of the offending
 * lexeme. This set is internal to the library; consumers should not
 * rely on its identity.
 *
 * @type {Set<string>}
 */
const ecmascriptReservedWords = new Set(
[
    "break"      , "case"      , "catch"     , "class"      , "const"    ,
    "continue"   , "debugger"  , "default"   , "delete"     , "do"       ,
    "else"       , "enum"      , "export"    , "extends"    , "finally"  ,
    "for"        , "function"  , "if"        , "import"     , "in"       ,
    "instanceof" , "return"    , "super"     , "switch"     , "this"     ,
    "throw"      , "try"       , "typeof"    , "var"        , "void"     ,
    "while"      , "with"      ,
    "let"        , "static"    , "yield"     ,
    "await"      , "async"     ,
    "implements" , "interface" , "package"   , "private"    ,
    "protected"  , "public"
] ) ;

export default ecmascriptReservedWords ;
