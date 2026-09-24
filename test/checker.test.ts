import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCheck } from "../src/checker";
import { DEFAULT_SYMBOL_EXTENSIONS } from "../src/types";

const FIXTURE_ROOT = path.resolve(__dirname, "fixtures/repo");

describe("runCheck", () => {
  it("passes when linked/inline file-path references really exist", async () => {
    const result = await runCheck({
      root: FIXTURE_ROOT,
      docsGlobs: ["docs/good-path.md"],
      symbolExtensions: DEFAULT_SYMBOL_EXTENSIONS,
    });

    expect(result.brokenCount).toBe(0);
    const filePathFindings = result.findings.filter((f) => f.reference.kind === "file-path");
    expect(filePathFindings.length).toBeGreaterThan(0);
    expect(filePathFindings.every((f) => f.ok)).toBe(true);
  });

  it("fails with a helpful message when a linked file path does not exist", async () => {
    const result = await runCheck({
      root: FIXTURE_ROOT,
      docsGlobs: ["docs/bad-path.md"],
      symbolExtensions: DEFAULT_SYMBOL_EXTENSIONS,
    });

    expect(result.brokenCount).toBe(1);
    const [finding] = result.findings;
    expect(finding.ok).toBe(false);
    expect(finding.reference.kind).toBe("file-path");
    expect(finding.reference.raw).toBe("../src/does-not-exist.ts");
    expect(finding.reference.docFile).toBe("docs/bad-path.md");
    expect(finding.reason).toMatch(/file not found/i);
  });

  it("passes when a docdrift:symbol block names a symbol that really exists", async () => {
    const result = await runCheck({
      root: FIXTURE_ROOT,
      docsGlobs: ["docs/good-symbol.md"],
      symbolExtensions: DEFAULT_SYMBOL_EXTENSIONS,
    });

    expect(result.brokenCount).toBe(0);
    const [finding] = result.findings;
    expect(finding.reference.kind).toBe("symbol");
    expect(finding.reference.raw).toBe("fooBar");
    expect(finding.ok).toBe(true);
    expect(finding.matchedAt?.file.replace(/\\/g, "/")).toBe("src/foo.ts");
  });

  it("fails when a docdrift:symbol block names a symbol that is not declared anywhere", async () => {
    const result = await runCheck({
      root: FIXTURE_ROOT,
      docsGlobs: ["docs/bad-symbol.md"],
      symbolExtensions: DEFAULT_SYMBOL_EXTENSIONS,
    });

    expect(result.brokenCount).toBe(1);
    const [finding] = result.findings;
    expect(finding.ok).toBe(false);
    expect(finding.reference.kind).toBe("symbol");
    expect(finding.reference.raw).toBe("nonExistentSymbol123");
    expect(finding.reason).toMatch(/no declaration-like occurrence/i);
  });

  it("checks every fixture doc together and only flags the two intentionally-broken references", async () => {
    const result = await runCheck({
      root: FIXTURE_ROOT,
      docsGlobs: ["docs/*.md"],
      symbolExtensions: DEFAULT_SYMBOL_EXTENSIONS,
    });

    expect(result.docFilesScanned).toHaveLength(4);
    expect(result.brokenCount).toBe(2);
    const brokenRaws = result.findings.filter((f) => !f.ok).map((f) => f.reference.raw);
    expect(brokenRaws.sort()).toEqual(["../src/does-not-exist.ts", "nonExistentSymbol123"]);
  });
});
