/**
 * Real filesystem checks for file-path references. We try resolving the
 * raw path two ways - relative to the Markdown file's own directory, and
 * relative to the repo root - since both conventions are common in docs.
 */
import fs from "node:fs";
import path from "node:path";

export interface PathCheckResult {
  exists: boolean;
  /** The absolute path that was found to exist, if any. */
  resolvedPath?: string;
  /** Every absolute path DocDrift tried, for reporting when nothing matched. */
  triedPaths: string[];
}

function candidatePaths(rawPath: string, absoluteDocFile: string, root: string): string[] {
  const candidates: string[] = [];

  // Root-relative, e.g. "/src/foo.ts" -> "<root>/src/foo.ts".
  const rootRelative = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;

  candidates.push(path.resolve(path.dirname(absoluteDocFile), rawPath));
  candidates.push(path.resolve(root, rootRelative));

  return Array.from(new Set(candidates));
}

/**
 * Check whether `rawPath` (as written in a doc) resolves to a real file,
 * trying both doc-relative and repo-root-relative resolution.
 */
export function checkPathReference(
  rawPath: string,
  absoluteDocFile: string,
  root: string,
): PathCheckResult {
  const tried = candidatePaths(rawPath, absoluteDocFile, root);
  for (const candidate of tried) {
    if (fs.existsSync(candidate)) {
      return { exists: true, resolvedPath: candidate, triedPaths: tried };
    }
  }
  return { exists: false, triedPaths: tried };
}
