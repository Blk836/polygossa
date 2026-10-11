import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importCaseProblems, javaCaseProblems } from "./check.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "case-paths-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

test("the frontend's imports name every file in its own letter case", () => {
  assert.deepEqual(importCaseProblems(join(repo, "frontend")), []);
});

test("every Java file is named like its type and sits in its package's folder", () => {
  assert.deepEqual(javaCaseProblems(join(repo, "backend", "src")), []);
});

test("an alias import with the wrong case is reported with the file and the path", () => {
  const root = fixture({
    "components/polly.tsx": "export const Polly = 1;",
    "app/page.tsx": 'import { Polly } from "@/components/Polly";\n',
  });
  assert.deepEqual(importCaseProblems(root), ['app/page.tsx: "@/components/Polly" differs in letter case from the file']);
});

test("relative imports, folders and dynamic imports are checked too", () => {
  const root = fixture({
    "lib/Api/index.ts": "export {};",
    "lib/a.ts": 'import x from "./api";\nexport const y = () => import("../Lib/a");\n',
  });
  assert.deepEqual(importCaseProblems(root), [
    'lib/a.ts: "./api" differs in letter case from the file',
    'lib/a.ts: "../Lib/a" differs in letter case from the file',
  ]);
});

test("correct imports, packages and paths with no file at all aren't reported", () => {
  const root = fixture({
    "lib/api.ts": "export {};",
    "app/globals.css": "",
    "app/page.tsx": 'import "./globals.css";\nimport React from "react";\nimport { a } from "@/lib/api";\n'
      + 'import { b } from "@/lib/missing";\n',
  });
  assert.deepEqual(importCaseProblems(root), []);
});

test("node_modules and build output are skipped", () => {
  const root = fixture({
    "node_modules/x/index.ts": 'import "./Nope";\nexport {};',
    "node_modules/x/nope.ts": "",
    ".next/server/a.ts": 'import "./B";\n',
    ".next/server/b.ts": "",
  });
  assert.deepEqual(importCaseProblems(root), []);
});

test("a Java file named in a different case from its type is reported", () => {
  const root = fixture({ "main/java/app/lector/textService.java": "package app.lector;\n\npublic class TextService {}\n" });
  assert.deepEqual(javaCaseProblems(root),
    ["main/java/app/lector/textService.java: declares no type named textService"]);
});

test("a Java folder in a different case from the package is reported", () => {
  const root = fixture({ "main/java/app/Lector/Foo.java": "package app.lector;\n\nrecord Foo() {}\n" });
  assert.deepEqual(javaCaseProblems(root),
    ["main/java/app/Lector/Foo.java: folder doesn't match package app.lector"]);
});

test("records, enums, interfaces and annotations count as types", () => {
  const root = fixture({
    "main/java/app/A.java": "package app;\nrecord A() {}\n",
    "main/java/app/B.java": "package app;\npublic enum B { X }\n",
    "main/java/app/C.java": "package app;\ninterface C {}\n",
    "main/java/app/D.java": "package app;\npublic @interface D {}\n",
  });
  assert.deepEqual(javaCaseProblems(root), []);
});
