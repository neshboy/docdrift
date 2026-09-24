/**
 * Formats a CheckResult as either a human-readable text report or JSON.
 */
import type { CheckResult } from "./types";

export interface FormatOptions {
  json?: boolean;
}

export function formatReport(result: CheckResult, options: FormatOptions = {}): string {
  if (options.json) {
    return JSON.stringify(result, null, 2);
  }

  const lines: string[] = [];
  const total = result.findings.length;
  const docCount = result.docFilesScanned.length;

  lines.push(
    `DocDrift checked ${docCount} doc file(s) and found ${total} reference(s) to verify.`,
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
