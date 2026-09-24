/**
 * Orchestrates a full DocDrift check: find doc files, parse each one for
 * checkable references, and verify every reference against the repo.
 */
import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";
import { extractReferences } from "./markdown";
import { checkPathReference } from "./pathCheck";
import { clearSymbolSearchCache, findSymbolDeclaration, isValidIdentifier } from "./symbolCheck";
import {
  DEFAULT_IGNORE_GLOBS,
  DEFAULT_PATH_EXTENSIONS,
  DEFAULT_SYMBOL_EXTENSIONS,
  type CheckOptions,
  type CheckResult,
  type Finding,
} from "./types";

async function findDocFiles(root: string, docsGlobs: string[]): Promise<string[]> {
  const relFiles = await fg(docsGlobs, {
    cwd: root,
    ignore: DEFAULT_IGNORE_GLOBS,
    onlyFiles: true,
    unique: true,
    dot: false,
  });
  return relFiles.sort();
}

export async function runCheck(options: CheckOptions): Promise<CheckResult> {
  const root = path.resolve(options.root);
  const symbolExtensions = options.symbolExtensions.length
    ? options.symbolExtensions
    : DEFAULT_SYMBOL_EXTENSIONS;

  // Symbol source listing is cached per (root, extensions, ignore) inside
  // symbolCheck; make sure repeated runCheck() calls with different fixture
  // roots (as in our test suite) never see a stale listing.
  clearSymbolSearchCache();

  const docFilesRel = await findDocFiles(root, options.docsGlobs);
  const findings: Finding[] = [];

  for (const docFileRel of docFilesRel) {
    const absoluteDocFile = path.resolve(root, docFileRel);
    const text = fs.readFileSync(absoluteDocFile, "utf8");
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
            reason: `file not found. Tried:\n      - ${result.triedPaths.join("\n      - ")}`,
          });
        }
        continue;
      }

      // reference.kind === "symbol"
      if (!isValidIdentifier(reference.raw)) {
        findings.push({
          reference,
          ok: false,
          reason: `"${reference.raw}" is not a valid identifier for a docdrift:symbol block`,
        });
        continue;
      }

      const match = await findSymbolDeclaration(reference.raw, {
        root,
        extensions: symbolExtensions,
        ignoreGlobs: options.ignoreGlobs,
      });

      if (match) {
        findings.push({
          reference,
          ok: true,
          matchedAt: { file: path.relative(root, match.file), line: match.line },
        });
      } else {
        findings.push({
          reference,
          ok: false,
          reason: `no declaration-like occurrence of "${reference.raw}" found in scanned source files (*.${symbolExtensions.join(", *.")})`,
        });
      }
    }
  }

  const brokenCount = findings.filter((f) => !f.ok).length;
  return { findings, docFilesScanned: docFilesRel, brokenCount };
}
