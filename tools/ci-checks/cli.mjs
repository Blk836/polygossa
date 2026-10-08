import { checksFor, outputLines } from "./checks.mjs";

/** Changed files (one per line) in; `check=true|false` lines out. `--all` runs every check. */
export function main(args, input) {
  const files = args.includes("--all") ? null : input.split("\n");
  return outputLines(checksFor(files)).join("\n") + "\n";
}
