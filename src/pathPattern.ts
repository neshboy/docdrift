/**
 * Heuristics for recognizing "this text looks like a repo-relative file
 * path" inside prose, link targets, and code. This is intentionally a
 * pragmatic pattern match, not a full URI parser - see README "Limitations".
 */

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//; // http://, https://, ftp://, etc.
const OTHER_NON_PATH_SCHEME_RE = /^(mailto:|tel:|javascript:|data:)/i;

/** True if a Markdown link target is external or an in-page anchor, and therefore not a checkable file path. */
export function isExternalOrAnchor(url: string): boolean {
  if (!url) return true;
  if (url.startsWith("#")) return true;
  if (SCHEME_RE.test(url)) return true;
  if (OTHER_NON_PATH_SCHEME_RE.test(url)) return true;
  return false;
}

/** Strip a trailing `#fragment` or `?query` from a link target before treating it as a file path. */
export function stripFragmentAndQuery(url: string): string {
  return url.split("#")[0].split("?")[0];
}

// A path with at least one directory separator, ending in a plausible extension.
// e.g. src/foo/bar.ts, ./a/b.py, ../README.md
const SLASH_PATH_RE = /^\.{0,2}\/?(?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]{1,10}$/;

// Punctuation commonly stuck to a path-like word in prose ("see src/a.ts."), stripped before matching.
const TRAILING_PUNCT_RE = /[.,;:!?)'"]+$/;
const LEADING_PUNCT_RE = /^['"(]+/;

function bareFileRe(extensions: string[]): RegExp {
  const escaped = extensions.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^[\\w-]+\\.(${escaped.join("|")})$`, "i");
}

export interface PathToken {
  token: string;
  /** Zero-based line index relative to the start of the scanned text. */
  lineIndex: number;
}

/**
 * Scan a block of text (fenced code content, or a single inline code span)
 * line by line for whitespace-delimited tokens that look like repo-relative
 * file paths. Bare filenames without a `/` are only matched when their
 * extension is in `bareExtensions`, to avoid false positives like version
 * numbers ("1.2") or abbreviations ("e.g.").
 */
export function extractPathTokens(text: string, bareExtensions: string[]): PathToken[] {
  const bareRe = bareFileRe(bareExtensions);
  const results: PathToken[] = [];
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
