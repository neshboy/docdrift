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
  return [
    // JS/TS/Java/C#/Go/Rust-ish function & type declarations.
    new RegExp(`\\bfunction\\*?\\s+${n}\\b`),
    new RegExp(`\\bclass\\s+${n}\\b`),
    new RegExp(`\\binterface\\s+${n}\\b`),
    new RegExp(`\\btype\\s+${n}\\b`),
    new RegExp(`\\benum\\s+${n}\\b`),
    new RegExp(`\\bstruct\\s+${n}\\b`),
    new RegExp(`\\bfunc\\s+(?:\\([^)]*\\)\\s*)?${n}\\b`), // Go (incl. methods with receiver)
    new RegExp(`\\bfn\\s+${n}\\b`), // Rust
    // Variable-ish declarations.
    new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+${n}\\b`),
    new RegExp(`\\bdef\\s+${n}\\b`), // Python
    // "name = function/arrow" or "name: (..) => .." assignment styles.
    new RegExp(`\\b${n}\\s*[:=]\\s*(?:async\\s+)?function\\b`),
    new RegExp(`\\b${n}\\s*[:=]\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::[^=]+)?=>`),
    // Java/C#/C++ style method or field declaration: modifiers, a type, then the name and "(" or ";"/"=".
    new RegExp(
      `\\b(?:public|private|protected|internal|static|final|readonly|virtual|override|abstract|async)\\s+[\\w<>\\[\\],.\\s]*?\\b${n}\\s*\\(`,
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
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (patterns.some((re) => re.test(line))) {
        return { file, line: i + 1 };
      }
    }
  }
  return undefined;
}
