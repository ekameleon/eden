/**
 * @file eden — ECMAScript Data Exchange Notation.
 *
 * Public façade of the library. Every symbol re-exported from this
 * module is part of the supported public API; anything else (for
 * instance the `Lexer` or `Parser` classes and internal helpers) is
 * an implementation detail and may change without notice.
 *
 * @see https://github.com/ekameleon/eden
 */

export { default as EdenError }       from "./errors/EdenError.js" ;
export { default as EdenSyntaxError } from "./errors/EdenSyntaxError.js" ;

export { default as TokenType } from "./lexer/TokenType.js" ;
export { default as tokenize }  from "./lexer/tokenize.js" ;

export { default as LiteralKind } from "./parser/ast/LiteralKind.js" ;
export { default as NodeType }    from "./parser/ast/NodeType.js" ;
export { default as ProgramMode } from "./parser/ast/ProgramMode.js" ;
export { default as parseToAST }  from "./parser/parseToAST.js" ;

/**
 * Library version, kept in sync with `package.json`.
 * @type {string}
 */
export const VERSION = "0.1.0" ;
