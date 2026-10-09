import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commentsIn, isChecked, lineOf } from "./files.mjs";
import { removeRanges } from "./strip.mjs";

function trackedFiles(root) {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(isChecked);
}

export function offenders(root) {
  return trackedFiles(root).flatMap((path) => {
    const text = readFileSync(join(root, path), "utf8");
    const comments = commentsIn(path, text);
    return comments.length ? [`${path}:${lineOf(text, comments[0][0])} (${comments.length})`] : [];
  });
}

export function stripAll(root) {
  for (const path of trackedFiles(root)) {
    const text = readFileSync(join(root, path), "utf8");
    const comments = commentsIn(path, text);
    if (comments.length) writeFileSync(join(root, path), removeRanges(text, comments));
  }
}
