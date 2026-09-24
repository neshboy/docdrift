import path from "node:path";
import { describe, expect, it } from "vitest";
import { clearSymbolSearchCache, findSymbolDeclaration, isValidIdentifier } from "../src/symbolCheck";

const FIXTURE_ROOT = path.resolve(__dirname, "fixtures/repo");

describe("findSymbolDeclaration", () => {
  it("finds a TypeScript function declaration", async () => {
    clearSymbolSearchCache();
    const match = await findSymbolDeclaration("fooBar", { root: FIXTURE_ROOT, extensions: ["ts"] });
    expect(match).toBeDefined();
    expect(match?.file.replace(/\\/g, "/")).toMatch(/src\/foo\.ts$/);
  });

  it("finds a Python def declaration", async () => {
    clearSymbolSearchCache();
    const match = await findSymbolDeclaration("python_symbol", {
      root: FIXTURE_ROOT,
      extensions: ["py"],
    });
    expect(match).toBeDefined();
    expect(match?.file.replace(/\\/g, "/")).toMatch(/src\/bar\.py$/);
  });

  it("returns undefined for a symbol that is not declared anywhere", async () => {
    clearSymbolSearchCache();
    const match = await findSymbolDeclaration("totallyMadeUpSymbolXYZ", {
      root: FIXTURE_ROOT,
      extensions: ["ts", "py"],
    });
    expect(match).toBeUndefined();
  });
});

describe("isValidIdentifier", () => {
  it("accepts identifier-shaped names", () => {
    expect(isValidIdentifier("fooBar")).toBe(true);
    expect(isValidIdentifier("_private$1")).toBe(true);
  });

  it("rejects names with spaces or path separators", () => {
    expect(isValidIdentifier("foo bar")).toBe(false);
    expect(isValidIdentifier("src/foo.ts")).toBe(false);
  });
});
