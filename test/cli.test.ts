import path from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli";

const FIXTURE_ROOT = path.resolve(__dirname, "fixtures/repo");

describe("cli run()", () => {
  it("shows help and exits 0 for --help", async () => {
    const { code, output } = await run(["--help"]);
    expect(code).toBe(0);
    expect(output).toMatch(/docdrift - a CI gate/);
  });

  it("exits 1 for an unknown command", async () => {
    const { code, output } = await run(["bogus"]);
    expect(code).toBe(1);
    expect(output).toMatch(/Unknown command/);
  });

  it("returns exit code 0 and a passing report for a clean doc set", async () => {
    const { code, output } = await run([
      "check",
      "docs/good-path.md",
      "docs/good-symbol.md",
      "--root",
      FIXTURE_ROOT,
    ]);
    expect(code).toBe(0);
    expect(output).toMatch(/All \d+ reference\(s\) OK\./);
  });

  it("returns exit code 1 and reports the broken reference for a doc with a stale link", async () => {
    const { code, output } = await run(["check", "docs/bad-path.md", "--root", FIXTURE_ROOT]);
    expect(code).toBe(1);
    expect(output).toMatch(/FAIL docs[\\/]bad-path\.md/);
    expect(output).toMatch(/does-not-exist\.ts/);
  });

  it("supports --json output", async () => {
    const { code, output } = await run([
      "check",
      "docs/bad-symbol.md",
      "--root",
      FIXTURE_ROOT,
      "--json",
    ]);
    expect(code).toBe(1);
    const parsed = JSON.parse(output);
    expect(parsed.brokenCount).toBe(1);
  });
});
