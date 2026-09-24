#!/usr/bin/env node
import { run } from "./cli";

run(process.argv.slice(2)).then(
  ({ code, output }) => {
    // eslint-disable-next-line no-console
    console.log(output);
    process.exitCode = code;
  },
  (err) => {
    // eslint-disable-next-line no-console
    console.error("docdrift: unexpected error:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  },
);
