import { describe, expect, it } from "vitest";
import { extractReferences } from "../src/markdown";
import { DEFAULT_PATH_EXTENSIONS } from "../src/types";

describe("extractReferences", () => {
  it("extracts a relative-path link but ignores external URLs and in-page anchors", () => {
    const md = [
      "[local](src/foo.ts)",
      "[site](https://example.com/readme)",
      "[section](#intro)",
      "[email](mailto:a@b.com)",
    ].join("\n\n");

    const refs = extractReferences(md, "doc.md", DEFAULT_PATH_EXTENSIONS);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ kind: "file-path", raw: "src/foo.ts", source: "link" });
  });

  it("parses a docdrift:symbol fenced block into one symbol reference per non-comment, non-blank line", () => {
    const md = ["```docdrift:symbol", "# a comment, ignored", "fooBar", "", "BazQux", "```"].join(
      "\n",
    );

    const refs = extractReferences(md, "doc.md", DEFAULT_PATH_EXTENSIONS);
    expect(refs.map((r) => r.raw)).toEqual(["fooBar", "BazQux"]);
    expect(refs.every((r) => r.kind === "symbol" && r.source === "symbol-block")).toBe(true);
  });

  it("scans generic fenced code blocks for path-like tokens", () => {
    const md = ["```bash", "cat src/foo/bar.ts", "```"].join("\n");
    const refs = extractReferences(md, "doc.md", DEFAULT_PATH_EXTENSIONS);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      kind: "file-path",
      raw: "src/foo/bar.ts",
      source: "fenced-code",
    });
  });

  it("scans inline code spans for path-like tokens", () => {
    const md = "Update `README.md` before releasing.";
    const refs = extractReferences(md, "doc.md", DEFAULT_PATH_EXTENSIONS);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      kind: "file-path",
      raw: "README.md",
      source: "inline-code",
    });
  });

  it("does not flag ordinary prose-shaped inline code as a file path", () => {
    const md = "Run `e.g.` nothing, or version `1.2` here.";
    const refs = extractReferences(md, "doc.md", DEFAULT_PATH_EXTENSIONS);
    expect(refs).toHaveLength(0);
  });

  it("reports the correct doc line number for a symbol declared deep in a block", () => {
    const md = ["intro text", "", "```docdrift:symbol", "one", "two", "```"].join("\n");
    const refs = extractReferences(md, "doc.md", DEFAULT_PATH_EXTENSIONS);
    expect(refs.map((r) => r.line)).toEqual([4, 5]);
  });
});
