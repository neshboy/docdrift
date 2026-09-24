/**
 * GitHub Action logic for DocDrift. Kept separate from the thin
 * src/action-bin.ts entrypoint so it can be reasoned about (and, if useful,
 * imported) independently of @actions/core's process side effects.
 */
import * as core from "@actions/core";
import { runCheck } from "./checker";
import { formatReport } from "./report";
import { DEFAULT_DOC_GLOBS, DEFAULT_SYMBOL_EXTENSIONS } from "./types";

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function runAction(): Promise<void> {
  try {
    const root = core.getInput("root") || process.env.GITHUB_WORKSPACE || process.cwd();
    const docsGlobInput = core.getInput("docs-glob");
    const docsGlobs = docsGlobInput ? splitCsv(docsGlobInput) : DEFAULT_DOC_GLOBS;
    const extInput = core.getInput("extensions");
    const symbolExtensions = extInput ? splitCsv(extInput) : DEFAULT_SYMBOL_EXTENSIONS;

    const result = await runCheck({ root, docsGlobs, symbolExtensions });
    const report = formatReport(result, { json: false });

    core.info(report);
    core.setOutput("broken-count", String(result.brokenCount));

    for (const finding of result.findings) {
      if (finding.ok) continue;
      const ref = finding.reference;
      core.error(`[${ref.kind}] "${ref.raw}": ${finding.reason}`, {
        file: ref.docFile,
        startLine: ref.line,
      });
    }

    if (result.brokenCount > 0) {
      core.setFailed(`${result.brokenCount} broken documentation reference(s) found.`);
    }
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}
