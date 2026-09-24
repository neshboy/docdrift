/**
 * Programmatic entrypoint - re-exports the pieces of DocDrift's core
 * engine used by both the CLI and the GitHub Action.
 */
export { runCheck } from "./checker";
export { formatReport } from "./report";
export { extractReferences, SYMBOL_BLOCK_INFO } from "./markdown";
export { checkPathReference } from "./pathCheck";
export { findSymbolDeclaration, isValidIdentifier } from "./symbolCheck";
export * from "./types";
