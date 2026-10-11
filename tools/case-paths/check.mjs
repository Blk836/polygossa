import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const SKIP = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report", "reports", ".stryker-tmp",
  "coverage", "build", "out"]);
const SOURCE = /\.(ts|tsx|mjs|js)$/;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)["']([^"']+)["']/g;
const ENDINGS = ["", ".ts", ".tsx", ".mjs", ".js", ".json", "/index.ts", "/index.tsx", "/index.js"];

function files(dir, keep) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, keep);
    return keep.test(entry.name) ? [path] : [];
  });
}

function exactlyExists(root, path) {
  let dir = root;
  for (const part of relative(root, path).split(sep)) {
    if (part === "..") {
      dir = dirname(dir);
      continue;
    }
    if (!readdirSync(dir).includes(part)) return false;
    dir = join(dir, part);
  }
  return true;
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function target(root, file, spec) {
  if (spec.startsWith("@/")) return join(root, spec.slice(2));
  if (spec.startsWith("./") || spec.startsWith("../")) return join(dirname(file), spec);
  return null;
}

function caseProblem(root, file, spec) {
  const base = target(root, file, spec);
  if (base === null) return false;
  const found = ENDINGS.map((ending) => base + ending).filter(isFile);
  return found.length > 0 && !found.some((path) => exactlyExists(root, path));
}

const shown = (root, file) => relative(root, file).split(sep).join("/");

export function importCaseProblems(root) {
  return files(root, SOURCE).flatMap((file) => [...readFileSync(file, "utf8").matchAll(IMPORT)]
    .map((match) => match[1])
    .filter((spec) => caseProblem(root, file, spec))
    .map((spec) => `${shown(root, file)}: "${spec}" differs in letter case from the file`));
}

function javaProblem(root, file) {
  const source = readFileSync(file, "utf8");
  const name = file.slice(file.lastIndexOf(sep) + 1, -".java".length);
  if (!new RegExp(`\\b(class|interface|enum|record|@interface)\\s+${name}\\b`).test(source)) {
    return `declares no type named ${name}`;
  }
  const pkg = source.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1];
  const folder = shown(root, dirname(file));
  if (pkg && !folder.endsWith(pkg.replaceAll(".", "/"))) return `folder doesn't match package ${pkg}`;
  return null;
}

export function javaCaseProblems(root) {
  return files(root, /\.java$/).flatMap((file) => {
    const problem = javaProblem(root, file);
    return problem ? [`${shown(root, file)}: ${problem}`] : [];
  });
}
