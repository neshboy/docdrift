# DocDrift

DocDrift is a CI gate that keeps your Markdown documentation honest. It parses the
file paths, links, and code symbols you reference in your docs and fails the build
the moment one of them goes stale.

## Why

Docs rot silently. Someone renames a module, or deletes a helper function a
tutorial still tells readers to call, and nothing breaks - until a reader
follows the doc and hits a dead link or an import that doesn't exist. Linters
check your code. Nothing, by default, checks whether your prose still matches
it. DocDrift is that check.

## What it actually checks

DocDrift parses your Markdown with a real parser
([`remark-parse`](https://github.com/remarkjs/remark/tree/main/packages/remark-parse),
which builds a real [mdast](https://github.com/syntax-tree/mdast) AST) and walks
three kinds of nodes:

1. **Markdown links** - `[text](path)`. If `path` isn't an external URL
   (`https://...`), an anchor (`#section`), or a `mailto:`/`tel:` link, DocDrift
   treats it as a claim that a file exists at that path, relative to either the
   doc's own directory or the repo root (both are tried).
2. **Fenced code blocks and inline `` `code` `` spans** - scanned for tokens that
   look like repo-relative file paths (a `/`-separated path ending in an
   extension, such as [`src/checker.ts`](src/checker.ts), or a bare filename
   with a recognized extension, e.g. `README.md`).
3. **`docdrift:symbol` fenced code blocks** (see below) - an explicit, documented
   convention for saying "this identifier should exist somewhere in the
   codebase."

Every one of those claims is checked for real: file paths are checked against
the actual filesystem, and symbols are checked with a real regex search across
your source tree for a declaration-shaped occurrence of the name.

If anything is stale, DocDrift prints an itemized report (doc file, line number,
the broken reference, and why it's considered broken) and exits non-zero.

## Install / quick start

```bash
npm install --save-dev docdrift
npx docdrift check
```

With no arguments, `docdrift check` looks at `docs/**/*.md` and the root
`README.md`. You can pass your own glob(s) instead:

```bash
npx docdrift check "docs/**/*.md" "guides/**/*.md" README.md
```

## The `docdrift:symbol` convention

There's no universal Markdown convention for "this inline code is a symbol name,
please verify it exists" - inline code is used for all sorts of things (shell
commands, config keys, literal values). So DocDrift defines one explicit,
narrow convention instead of guessing: a fenced code block whose info string is
exactly `docdrift:symbol`.

````markdown
```docdrift:symbol
runCheck
```
````

Every non-blank line in the block (lines starting with `#` are treated as
comments and ignored) names a symbol that DocDrift will search for across your
source tree. For example, this really is a symbol declared in this repo's own
`src/checker.ts`, so this block passes DocDrift's own self-check:

```docdrift:symbol
runCheck
```

DocDrift finds it by scanning source files (extensions configurable via
`--ext`, default `ts,tsx,js,jsx,mjs,cjs,py,go,rs,java,rb,c,h,cpp,hpp,cs`) for a
declaration-shaped line - e.g. `function runCheck`, `export async function
runCheck`, `const runCheck`, `class runCheck`, `def runCheck` (Python), `func
runCheck` (Go), `fn runCheck` (Rust), and a few common method/field shapes. If
none of your source files contain a line that looks like a declaration of that
name, the check fails. You can see the real implementation at
[`src/checker.ts`](src/checker.ts) and [`src/symbolCheck.ts`](src/symbolCheck.ts).

File paths work the same way, with no special annotation needed - any relative
Markdown link, plus any path-shaped token in code, is checked automatically.
For example, [the CLI entrypoint](src/cli.ts) is a real link DocDrift verifies
every time this README is checked.

## CLI usage

```
docdrift check [globs...] [options]

Arguments:
  globs                 Markdown glob pattern(s) to check.
                         Defaults to: docs/**/*.md, README.md

Options:
  --root <path>          Repository root to check against (default: cwd)
  --ext <a,b,c>           Comma-separated source file extensions to scan
                          for docdrift:symbol declarations
  --json                  Print the report as JSON instead of text
  -h, --help              Show help text
```

Exit code is `0` when every reference checks out, `1` when at least one is
broken - wire `docdrift check` into CI as a required step.

## GitHub Action

DocDrift ships as a GitHub Action too, using the same checking engine (see
[`src/action.ts`](src/action.ts)), bundled to a committed CJS file at
[`dist/action.cjs`](dist/action.cjs) via [tsup](https://tsup.egoist.dev/), the
same pattern used to ship the CLI at [`dist/cli.cjs`](dist/cli.cjs).

```yaml
name: docs
on: [pull_request]
jobs:
  docdrift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: <your-org>/docdrift@v1
        with:
          docs-glob: "docs/**/*.md,README.md" # optional, this is the default
          extensions: "ts,tsx,py" # optional
```

Inputs: `root`, `docs-glob`, `extensions` (all optional). Output: `broken-count`.
Broken references are also reported as GitHub Actions error annotations
pointing at the exact doc file and line.

## How it's built

- TypeScript, compiled/bundled with [tsup](https://tsup.egoist.dev/) to CJS.
- Markdown parsing: `unified` + `remark-parse` (real mdast parsing, not string
  hacking).
- File globbing: `fast-glob`.
- GitHub Action inputs/outputs/annotations: `@actions/core`.
- Tests: `vitest`, against real fixture Markdown files and a real fixture
  mini-repo under [`test/fixtures/repo`](test/fixtures/repo) - no mocked
  filesystem, no mocked parser.

## Limitations (read this before relying on it)

DocDrift is honest about what it can and can't do:

- **Symbol checking is a regex/pattern search, not a language server.** There is
  no AST-aware, cross-file, type-resolving analysis. This means:
  - **False negatives**: a real declaration written in an unusual style (e.g.
    destructuring assignment, decorators, multi-line generics, macro-generated
    bindings, a language DocDrift doesn't have a pattern for) may not be
    recognized, even though the symbol genuinely exists.
  - **False positives**: DocDrift will happily match an unrelated declaration
    that merely shares the same name elsewhere in the codebase - it has no
    notion of scope, module, or import path. A generic name like `run` or
    `Config` declared anywhere will "pass" a `docdrift:symbol` check even if
    the doc meant a completely different `run`/`Config`.
- **File-path detection in prose/code is heuristic**, based on "looks like a
  path" pattern matching (slash-separated segments ending in an extension, or a
  bare filename with a recognized extension). It can miss unusually-formatted
  paths and, rarely, flag something that merely resembles a path.
- **No monorepo/alias resolution.** DocDrift resolves paths relative to the doc
  file and the repo root only - it does not understand `tsconfig.json` `paths`,
  package-manager workspace aliases, or symlink-aware path rewriting.
- Markdown links are only checked when they look like a relative path (not an
  external URL, anchor, `mailto:`, etc.) - DocDrift does not check that
  external links are reachable.

If you need guaranteed-correct symbol resolution, use your language's real
tooling (a language server, `tsc`, etc.) for code; DocDrift's job is to catch
the common, cheap-to-detect case of docs drifting from an evolving codebase,
not to replace static analysis.

## License

MIT © DocDrift contributors
