/**
 * Real Markdown parsing via `unified` + `remark-parse` (mdast). We walk the
 * resulting AST for three constructs - links, fenced code blocks, and inline
 * code spans - and turn each into zero or more checkable DocReferences.
 *
 * The DocDrift symbol convention: a fenced code block whose info string is
 * exactly `docdrift:symbol` is treated specially - every non-blank,
 * non-comment line inside it names a symbol DocDrift should verify exists
 * somewhere in the codebase. See README.md for the full convention.
 */
import type { Code, InlineCode, Link, Root } from "mdast";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { extractPathTokens, isExternalOrAnchor, stripFragmentAndQuery } from "./pathPattern";
import type { DocReference } from "./types";

export const SYMBOL_BLOCK_INFO = "docdrift:symbol";

// remark-parse ships as an ESM default export. Under vitest/vite this
// import resolves to the plugin function directly, but esbuild's CJS
// "node mode" interop (used by our tsup CJS build) double-wraps modules
// that are already interop-flagged, so `remarkParse` can come through as
// `{ default: fn }` instead of `fn` there. Handle both shapes defensively
// rather than depending on a particular bundler's interop behavior.
const remarkParsePlugin: typeof remarkParse =
  typeof remarkParse === "function"
    ? remarkParse
    : (remarkParse as unknown as { default: typeof remarkParse }).default;

const processor = unified().use(remarkParsePlugin);

function parseMarkdown(text: string): Root {
  return processor.parse(text) as Root;
}

/**
 * Extract every checkable DocReference from a Markdown document's text.
 * `docFile` is the path (relative to the repo root) used purely for
 * reporting - it is attached to every reference produced.
 */
export function extractReferences(
  text: string,
  docFile: string,
  bareExtensions: string[],
): DocReference[] {
  const tree = parseMarkdown(text);
  const refs: DocReference[] = [];

  visit(tree, "link", (node: Link) => {
    const url = node.url ?? "";
    if (isExternalOrAnchor(url)) return;
    const line = node.position?.start.line ?? 1;
    refs.push({
      kind: "file-path",
      raw: stripFragmentAndQuery(url),
      docFile,
      line,
      source: "link",
    });
  });

  visit(tree, "code", (node: Code) => {
    const startLine = node.position?.start.line ?? 1;
    const lang = (node.lang ?? "").trim();

    if (lang === SYMBOL_BLOCK_INFO) {
      const lines = node.value.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        refs.push({
          kind: "symbol",
          raw: trimmed,
          docFile,
          // +1 for the opening ``` fence line itself.
          line: startLine + 1 + i,
          source: "symbol-block",
        });
      }
      return;
    }

    const tokens = extractPathTokens(node.value, bareExtensions);
    for (const { token, lineIndex } of tokens) {
      refs.push({
        kind: "file-path",
        raw: token,
        docFile,
        line: startLine + 1 + lineIndex,
        source: "fenced-code",
      });
    }
  });

  visit(tree, "inlineCode", (node: InlineCode) => {
    const startLine = node.position?.start.line ?? 1;
    const tokens = extractPathTokens(node.value, bareExtensions);
    for (const { token, lineIndex } of tokens) {
      refs.push({
        kind: "file-path",
        raw: token,
        docFile,
        line: startLine + lineIndex,
        source: "inline-code",
      });
    }
  });

  return refs;
}
