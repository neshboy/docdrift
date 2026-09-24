/**
 * `docdrift` CLI logic. Kept process-effect-free (no process.exit / no
 * console output here) so it is easy to unit test - see test/cli.test.ts.
 * The actual executable is the thin src/bin.ts wrapper.
 */
import { runCheck } from "./checker";
import { formatReport } from "./report";
import { DEFAULT_DOC_GLOBS, DEFAULT_SYMBOL_EXTENSIONS } from "./types";

export interface CliRunResult {
  code: number;
  output: string;
}

const HELP_TEXT = `docdrift - a CI gate that keeps documentation honest

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

export async function run(argv: string[]): Promise<CliRunResult> {
  const args = [...argv];
  const command = args.shift();

  if (command === "-h" || command === "--help" || command === undefined) {
    return { code: command === undefined ? 1 : 0, output: HELP_TEXT };
  }

  if (command !== "check") {
    return { code: 1, output: `Unknown command: "${command}"\n\n${HELP_TEXT}` };
  }

  let root = process.cwd();
  let ext: string[] | undefined;
  let json = false;
  const globs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--root") {
      root = args[++i];
    } else if (arg === "--ext") {
      ext = args[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "-h" || arg === "--help") {
      return { code: 0, output: HELP_TEXT };
    } else if (arg.startsWith("--")) {
      return { code: 1, output: `Unknown option: "${arg}"\n\n${HELP_TEXT}` };
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
