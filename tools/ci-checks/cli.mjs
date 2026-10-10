import { checksFor, outputLines } from "./checks.mjs";

export function main(args, input) {
  const files = args.includes("--all") ? null : input.split("\n");
  return outputLines(checksFor(files)).join("\n") + "\n";
}
