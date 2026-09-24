#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/checker.ts
var import_fast_glob2 = __toESM(require("fast-glob"), 1);
var import_node_fs3 = __toESM(require("fs"), 1);
var import_node_path3 = __toESM(require("path"), 1);

// src/markdown.ts
var import_unified = require("unified");
var import_remark_parse = __toESM(require("remark-parse"), 1);
var import_unist_util_visit = require("unist-util-visit");

// src/pathPattern.ts
var SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
var OTHER_NON_PATH_SCHEME_RE = /^(mailto:|tel:|javascript:|data:)/i;
function isExternalOrAnchor(url) {
  if (!url) return true;
  if (url.startsWith("#")) return true;
  if (SCHEME_RE.test(url)) return true;
  if (OTHER_NON_PATH_SCHEME_RE.test(url)) return true;
  return false;
}
function stripFragmentAndQuery(url) {
  return url.split("#")[0].split("?")[0];
}
var SLASH_PATH_RE = /^\.{0,2}\/?(?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]{1,10}$/;
var TRAILING_PUNCT_RE = /[.,;:!?)'"]+$/;
var LEADING_PUNCT_RE = /^['"(]+/;
function bareFileRe(extensions) {
  const escaped = extensions.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^[\\w-]+\\.(${escaped.join("|")})$`, "i");
}
function extractPathTokens(text, bareExtensions) {
  const bareRe = bareFileRe(bareExtensions);
  const results = [];
  const lines = text.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawTokens = lines[lineIndex].split(/[\s"'`(),;<>{}\[\]]+/).filter(Boolean);
    for (const raw of rawTokens) {
      const cleaned = raw.replace(LEADING_PUNCT_RE, "").replace(TRAILING_PUNCT_RE, "");
      if (!cleaned) continue;
      if (cleaned.includes("://")) continue;
      if (SLASH_PATH_RE.test(cleaned) || bareRe.test(cleaned)) {
        results.push({ token: cleaned, lineIndex });
      }
    }
  }
  return results;
}

// src/markdown.ts
var SYMBOL_BLOCK_INFO = "docdrift:symbol";
var remarkParsePlugin = typeof import_remark_parse.default === "function" ? import_remark_parse.default : import_remark_parse.default.default;
var processor = (0, import_unified.unified)().use(remarkParsePlugin);
function parseMarkdown(text) {
  return processor.parse(text);
}
function extractReferences(text, docFile, bareExtensions) {
  const tree = parseMarkdown(text);
  const refs = [];
  (0, import_unist_util_visit.visit)(tree, "link", (node) => {
    const url = node.url ?? "";
    if (isExternalOrAnchor(url)) return;
    const line = node.position?.start.line ?? 1;
    refs.push({
      kind: "file-path",
      raw: stripFragmentAndQuery(url),
      docFile,
      line,
      source: "link"
    });
  });
  (0, import_unist_util_visit.visit)(tree, "code", (node) => {
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
          source: "symbol-block"
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
        source: "fenced-code"
      });
    }
  });
  (0, import_unist_util_visit.visit)(tree, "inlineCode", (node) => {
    const startLine = node.position?.start.line ?? 1;
    const tokens = extractPathTokens(node.value, bareExtensions);
    for (const { token, lineIndex } of tokens) {
      refs.push({
        kind: "file-path",
        raw: token,
        docFile,
        line: startLine + lineIndex,
        source: "inline-code"
      });
    }
  });
  return refs;
}

// src/pathCheck.ts
var import_node_fs = __toESM(require("fs"), 1);
var import_node_path = __toESM(require("path"), 1);
function candidatePaths(rawPath, absoluteDocFile, root) {
  const candidates = [];
  const rootRelative = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
  candidates.push(import_node_path.default.resolve(import_node_path.default.dirname(absoluteDocFile), rawPath));
  candidates.push(import_node_path.default.resolve(root, rootRelative));
  return Array.from(new Set(candidates));
}
function checkPathReference(rawPath, absoluteDocFile, root) {
  const tried = candidatePaths(rawPath, absoluteDocFile, root);
  for (const candidate of tried) {
    if (import_node_fs.default.existsSync(candidate)) {
      return { exists: true, resolvedPath: candidate, triedPaths: tried };
    }
  }
  return { exists: false, triedPaths: tried };
}

// src/symbolCheck.ts
var import_fast_glob = __toESM(require("fast-glob"), 1);
var import_node_fs2 = __toESM(require("fs"), 1);
var import_node_path2 = __toESM(require("path"), 1);

// src/types.ts
var DEFAULT_DOC_GLOBS = ["docs/**/*.md", "README.md"];
var DEFAULT_SYMBOL_EXTENSIONS = [
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
  "cs"
];
var DEFAULT_PATH_EXTENSIONS = [
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
  "sh"
];
var DEFAULT_IGNORE_GLOBS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**"
];

// src/symbolCheck.ts
var IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function isValidIdentifier(name) {
  return IDENTIFIER_RE.test(name);
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function buildDeclarationPatterns(name) {
  const n = escapeRegExp(name);
  return [
    // JS/TS/Java/C#/Go/Rust-ish function & type declarations.
    new RegExp(`\\bfunction\\*?\\s+${n}\\b`),
    new RegExp(`\\bclass\\s+${n}\\b`),
    new RegExp(`\\binterface\\s+${n}\\b`),
    new RegExp(`\\btype\\s+${n}\\b`),
    new RegExp(`\\benum\\s+${n}\\b`),
    new RegExp(`\\bstruct\\s+${n}\\b`),
    new RegExp(`\\bfunc\\s+(?:\\([^)]*\\)\\s*)?${n}\\b`),
    // Go (incl. methods with receiver)
    new RegExp(`\\bfn\\s+${n}\\b`),
    // Rust
    // Variable-ish declarations.
    new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+${n}\\b`),
    new RegExp(`\\bdef\\s+${n}\\b`),
    // Python
    // "name = function/arrow" or "name: (..) => .." assignment styles.
    new RegExp(`\\b${n}\\s*[:=]\\s*(?:async\\s+)?function\\b`),
    new RegExp(`\\b${n}\\s*[:=]\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::[^=]+)?=>`),
    // Java/C#/C++ style method or field declaration: modifiers, a type, then the name and "(" or ";"/"=".
    new RegExp(
      `\\b(?:public|private|protected|internal|static|final|readonly|virtual|override|abstract|async)\\s+[\\w<>\\[\\],.\\s]*?\\b${n}\\s*\\(`
    )
  ];
}
var cachedFiles = null;
async function listSourceFiles(opts) {
  const key = JSON.stringify({ root: opts.root, extensions: opts.extensions, ignore: opts.ignoreGlobs });
  if (cachedFiles && cachedFiles.key === key) return cachedFiles.files;
  const patterns = opts.extensions.map((ext) => `**/*.${ext}`);
  const ignore = [...DEFAULT_IGNORE_GLOBS, ...opts.ignoreGlobs ?? []];
  const relFiles = await (0, import_fast_glob.default)(patterns, {
    cwd: opts.root,
    ignore,
    onlyFiles: true,
    unique: true,
    dot: false
  });
  const files = relFiles.map((f) => import_node_path2.default.resolve(opts.root, f));
  cachedFiles = { key, files };
  return files;
}
function clearSymbolSearchCache() {
  cachedFiles = null;
}
async function findSymbolDeclaration(name, opts) {
  const patterns = buildDeclarationPatterns(name);
  const files = await listSourceFiles(opts);
  for (const file of files) {
    let content;
    try {
      content = import_node_fs2.default.readFileSync(file, "utf8");
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
  return void 0;
}

// src/checker.ts
async function findDocFiles(root, docsGlobs) {
  const relFiles = await (0, import_fast_glob2.default)(docsGlobs, {
    cwd: root,
    ignore: DEFAULT_IGNORE_GLOBS,
    onlyFiles: true,
    unique: true,
    dot: false
  });
  return relFiles.sort();
}
async function runCheck(options) {
  const root = import_node_path3.default.resolve(options.root);
  const symbolExtensions = options.symbolExtensions.length ? options.symbolExtensions : DEFAULT_SYMBOL_EXTENSIONS;
  clearSymbolSearchCache();
  const docFilesRel = await findDocFiles(root, options.docsGlobs);
  const findings = [];
  for (const docFileRel of docFilesRel) {
    const absoluteDocFile = import_node_path3.default.resolve(root, docFileRel);
    const text = import_node_fs3.default.readFileSync(absoluteDocFile, "utf8");
    const references = extractReferences(text, docFileRel, DEFAULT_PATH_EXTENSIONS);
    for (const reference of references) {
      if (reference.kind === "file-path") {
        const result = checkPathReference(reference.raw, absoluteDocFile, root);
        if (result.exists) {
          findings.push({ reference, ok: true, resolvedPath: result.resolvedPath });
        } else {
          findings.push({
            reference,
            ok: false,
            reason: `file not found. Tried:
      - ${result.triedPaths.join("\n      - ")}`
          });
        }
        continue;
      }
      if (!isValidIdentifier(reference.raw)) {
        findings.push({
          reference,
          ok: false,
          reason: `"${reference.raw}" is not a valid identifier for a docdrift:symbol block`
        });
        continue;
      }
      const match = await findSymbolDeclaration(reference.raw, {
        root,
        extensions: symbolExtensions,
        ignoreGlobs: options.ignoreGlobs
      });
      if (match) {
        findings.push({
          reference,
          ok: true,
          matchedAt: { file: import_node_path3.default.relative(root, match.file), line: match.line }
        });
      } else {
        findings.push({
          reference,
          ok: false,
          reason: `no declaration-like occurrence of "${reference.raw}" found in scanned source files (*.${symbolExtensions.join(", *.")})`
        });
      }
    }
  }
  const brokenCount = findings.filter((f) => !f.ok).length;
  return { findings, docFilesScanned: docFilesRel, brokenCount };
}

// src/report.ts
function formatReport(result, options = {}) {
  if (options.json) {
    return JSON.stringify(result, null, 2);
  }
  const lines = [];
  const total = result.findings.length;
  const docCount = result.docFilesScanned.length;
  lines.push(
    `DocDrift checked ${docCount} doc file(s) and found ${total} reference(s) to verify.`
  );
  lines.push("");
  const broken = result.findings.filter((f) => !f.ok);
  for (const finding of broken) {
    const ref = finding.reference;
    lines.push(`FAIL ${ref.docFile}:${ref.line}  [${ref.kind}] "${ref.raw}" (via ${ref.source})`);
    lines.push(`     ${finding.reason}`);
  }
  if (broken.length > 0) {
    lines.push("");
    lines.push(`${broken.length} broken reference(s) found out of ${total} checked.`);
  } else {
    lines.push(`All ${total} reference(s) OK.`);
  }
  return lines.join("\n");
}

// src/cli.ts
var HELP_TEXT = `docdrift - a CI gate that keeps documentation honest

Usage:
  docdrift check [globs...] [options]

Arguments:
  globs                 Markdown glob pattern(s) to check.
                         Defaults to: ${DEFAULT_DOC_GLOBS.join(", ")}

Options:
  --root <path>          Repository root to check against (default: cwd)
  --ext <a,b,c>           Comma-separated source file extensions to scan
                          for docdrift:symbol declarations
                          (default: ${DEFAULT_SYMBOL_EXTENSIONS.join(",")})
  --json                  Print the report as JSON instead of text
  -h, --help              Show this help text

Examples:
  docdrift check
  docdrift check "docs/**/*.md" README.md
  docdrift check --root ./my-repo --ext ts,tsx,py
`;
async function run(argv) {
  const args = [...argv];
  const command = args.shift();
  if (command === "-h" || command === "--help" || command === void 0) {
    return { code: command === void 0 ? 1 : 0, output: HELP_TEXT };
  }
  if (command !== "check") {
    return { code: 1, output: `Unknown command: "${command}"

${HELP_TEXT}` };
  }
  let root = process.cwd();
  let ext;
  let json = false;
  const globs = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--root") {
      root = args[++i];
    } else if (arg === "--ext") {
      ext = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "-h" || arg === "--help") {
      return { code: 0, output: HELP_TEXT };
    } else if (arg.startsWith("--")) {
      return { code: 1, output: `Unknown option: "${arg}"

${HELP_TEXT}` };
    } else {
      globs.push(arg);
    }
  }
  const docsGlobs = globs.length > 0 ? globs : DEFAULT_DOC_GLOBS;
  const symbolExtensions = ext ?? DEFAULT_SYMBOL_EXTENSIONS;
  const result = await runCheck({ root, docsGlobs, symbolExtensions });
  const output = formatReport(result, { json });
  return { code: result.brokenCount > 0 ? 1 : 0, output };
}

// src/bin.ts
run(process.argv.slice(2)).then(
  ({ code, output }) => {
    console.log(output);
    process.exitCode = code;
  },
  (err) => {
    console.error("docdrift: unexpected error:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
);
