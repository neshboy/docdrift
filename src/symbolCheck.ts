/**
 * Real (regex-based) search for a "declaration-shaped" occurrence of a
 * symbol name somewhere in the codebase.
 *
 * This is honestly a pattern search, not a language server: it recognizes
 * common declaration shapes across several languages (function/class/const
 * in JS/TS, def in Python, func in Go, fn in Rust, simple method shapes in
 * Java/C#-like languages, ...) but it can miss unusual declaration styles
 * (false negative) and it can match an unrelated symbol that merely shares
 * the same name (false positive). See README.md "Limitations".
 */
import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_IGNORE_GLOBS } from "./types";

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function isValidIdentifier(name: string): boolean {
  return IDENTIFIER_RE.test(name);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildDeclarationPatterns(name: string): RegExp[] {
  const n = escapeRegExp(name);
  // `\b` is a word-boundary based on `\w` ([A-Za-z0-9_]), so it never finds a
  // boundary next to `$` (e.g. the bare jQuery symbol `$`, or `foo$`) even
  // though isValidIdentifier treats `$` as a normal identifier character.
  // Use explicit lookaround that also excludes `$` from the "outside"
  // characters wherever the boundary sits immediately next to the name.
  const before = "(?<![\\w$])";
  const after = "(?![\\w$])";
  return [
    // JS/TS/Java/C#/Go/Rust-ish function & type declarations.
    new RegExp(`\\bfunction\\*?\\s+${n}${after}`),
    new RegExp(`\\bclass\\s+${n}${after}`),
    new RegExp(`\\binterface\\s+${n}${after}`),
    new RegExp(`\\btype\\s+${n}${after}`),
    new RegExp(`\\benum\\s+${n}${after}`),
    new RegExp(`\\bstruct\\s+${n}${after}`),
    new RegExp(`\\bfunc\\s+(?:\\([^)]*\\)\\s*)?${n}${after}`), // Go (incl. methods with receiver)
    new RegExp(`\\bfn\\s+${n}${after}`), // Rust
    // Variable-ish declarations.
    new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+${n}${after}`),
    new RegExp(`\\bdef\\s+${n}${after}`), // Python
    // "name = function/arrow" or "name: (..) => .." assignment styles.
    new RegExp(`${before}${n}\\s*[:=]\\s*(?:async\\s+)?function\\b`),
    new RegExp(`${before}${n}\\s*[:=]\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::[^=]+)?=>`),
    // Java/C#/C++ style method or field declaration: modifiers, a type, then the name and "(" or ";"/"=".
    new RegExp(
      `\\b(?:public|private|protected|internal|static|final|readonly|virtual|override|abstract|async)\\s+[\\w<>\\[\\],.\\s]*?${before}${n}\\s*\\(`,
    ),
  ];
}

export interface SymbolMatch {
  file: string; // absolute path
  line: number; // 1-based
}

export interface SymbolSearchOptions {
  root: string;
  extensions: string[];
  ignoreGlobs?: string[];
}

let cachedFiles: { key: string; files: string[] } | null = null;
// Parsed (split-into-lines) file contents, keyed by absolute file path.
// findSymbolDeclaration() is called once per docdrift:symbol reference, so
// without this cache a doc with many symbol references would re-read and
// re-split every scanned source file once per reference.
let cachedLines: Map<string, string[]> = new Map();

async function listSourceFiles(opts: SymbolSearchOptions): Promise<string[]> {
  const key = JSON.stringify({ root: opts.root, extensions: opts.extensions, ignore: opts.ignoreGlobs });
  if (cachedFiles && cachedFiles.key === key) return cachedFiles.files;

  const patterns = opts.extensions.map((ext) => `**/*.${ext}`);
  const ignore = [...DEFAULT_IGNORE_GLOBS, ...(opts.ignoreGlobs ?? [])];
  const relFiles = await fg(patterns, {
    cwd: opts.root,
    ignore,
    onlyFiles: true,
    unique: true,
    dot: false,
  });
  const files = relFiles.map((f) => path.resolve(opts.root, f));
  cachedFiles = { key, files };
  return files;
}

/** Clear the internal source-file listing cache (used between test runs / fixture changes). */
export function clearSymbolSearchCache(): void {
  cachedFiles = null;
  cachedLines = new Map();
}

function getFileLines(file: string): string[] | undefined {
  const cached = cachedLines.get(file);
  if (cached) return cached;

  let content: string;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  const lines = content.split(/\r?\n/);
  cachedLines.set(file, lines);
  return lines;
}

/**
 * Search the repo's source files for a declaration-shaped occurrence of
 * `name`. Returns the first match found (file + 1-based line number), or
 * `undefined` if nothing matched.
 */
export async function findSymbolDeclaration(
  name: string,
  opts: SymbolSearchOptions,
): Promise<SymbolMatch | undefined> {
  const patterns = buildDeclarationPatterns(name);
  const files = await listSourceFiles(opts);

  for (const file of files) {
    const lines = getFileLines(file);
    if (!lines) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (patterns.some((re) => re.test(line))) {
        return { file, line: i + 1 };
      }
    }
  }
  return undefined;
}
