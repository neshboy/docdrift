/**
 * Shared types for DocDrift's core checking engine.
 */

/** Where inside a Markdown document a reference was found. */
export type ReferenceSource = "link" | "fenced-code" | "inline-code" | "symbol-block";

/** The kind of checkable claim a reference represents. */
export type ReferenceKind = "file-path" | "symbol";

/**
 * A single checkable reference extracted from a Markdown document: either a
 * relative file path (from a link, or a path-shaped token found inside a
 * fenced/inline code span) or a symbol name declared via a
 * ```docdrift:symbol fenced code block.
 */
export interface DocReference {
  kind: ReferenceKind;
  /** The raw text as it appeared in the document (path or symbol name). */
  raw: string;
  /** Path to the Markdown file this reference came from, relative to the repo root. */
  docFile: string;
  /** 1-based line number within the doc file. */
  line: number;
  /** Which Markdown construct produced this reference. */
  source: ReferenceSource;
}

/** The outcome of checking a single DocReference against the repo. */
export interface Finding {
  reference: DocReference;
  ok: boolean;
  /** Human-readable explanation, always present when ok === false. */
  reason?: string;
  /** For successful file-path checks: the path that was actually resolved. */
  resolvedPath?: string;
  /** For successful symbol checks: where the declaration-shaped match was found. */
  matchedAt?: { file: string; line: number };
}

export interface CheckOptions {
  /** Absolute (or process-cwd-relative) path to the repository root. */
  root: string;
  /** Glob patterns (relative to root) identifying which Markdown files to check. */
  docsGlobs: string[];
  /** File extensions (no leading dot) to scan when looking for symbol declarations. */
  symbolExtensions: string[];
  /** Extra glob patterns to exclude from the symbol-declaration source scan. */
  ignoreGlobs?: string[];
}

export interface CheckResult {
  findings: Finding[];
  docFilesScanned: string[];
  brokenCount: number;
}

export const DEFAULT_DOC_GLOBS = ["docs/**/*.md", "README.md"];

export const DEFAULT_SYMBOL_EXTENSIONS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "java",
  "rb",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
];

/**
 * Extensions recognized when a *bare* filename (no `/` in it, e.g.
 * `README.md` or `package.json`) appears inside a fenced/inline code span
 * and we're deciding whether it looks like a file-path reference worth
 * checking. Deliberately broader than DEFAULT_SYMBOL_EXTENSIONS (which is
 * about scanning *source code* for symbol declarations) since docs commonly
 * reference config/markdown files too.
 */
export const DEFAULT_PATH_EXTENSIONS = [
  ...DEFAULT_SYMBOL_EXTENSIONS,
  "md",
  "mdx",
  "json",
  "yml",
  "yaml",
  "toml",
  "txt",
  "css",
  "scss",
  "html",
  "sh",
];

export const DEFAULT_IGNORE_GLOBS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
];
