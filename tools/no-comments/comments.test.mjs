import { test } from "node:test";
import assert from "node:assert/strict";
import { commentsIn, isChecked } from "./files.mjs";
import { removeRanges } from "./strip.mjs";

const strip = (path, text) => removeRanges(text, commentsIn(path, text));
const found = (path, text) => commentsIn(path, text).map(([s, e]) => text.slice(s, e));

test("finds line and block comments in TypeScript, Java and CSS", () => {
  assert.deepEqual(found("a.ts", "const a = 1; // one\n/* two */\nlet b;\n"), ["// one", "/* two */"]);
  assert.deepEqual(found("A.java", "/** doc */\nclass A { int a; // x\n}\n"), ["/** doc */", "// x"]);
  assert.deepEqual(found("a.ts", "function f() { // none\n}\nf(/* no args */);\nconst o = { /* empty */ };\n"),
    ["// none", "/* no args */", "/* empty */"]);
  assert.deepEqual(found("a.css", "a { color: red; } /* c */\n"), ["/* c */"]);
  assert.deepEqual(found("a.xml", "<a><!-- c --></a>\n"), ["<!-- c -->"]);
  assert.deepEqual(found("ci.yml", "a: 1\n  # c\nb: 2\n"), ["# c"]);
});

test("text that only looks like a comment is not one", () => {
  const ts = [
    'const u = "https://x.org/a"; const s = \'/* no */\';',
    "const t = `// ${'/*'} still text`;",
    "const r = /\\/\\/ not/g; const d = 4 / 2 / 1;",
  ].join("\n");
  assert.deepEqual(found("a.ts", ts), []);
  assert.deepEqual(found("a.tsx", 'const e = <p title="//x">see http://a.b // and /* this */</p>;\n'), []);
  assert.deepEqual(found("A.java", 'String u = "http://x"; char c = \'"\'; String t = """\n  // in block\n  """;\n'), []);
  assert.deepEqual(found("a.css", ".a { background: url(https://x.org/a.png); content: \"/* no */\"; }\n"), []);
  assert.deepEqual(found("ci.yml", 'a: "#fff"\nrun: echo a#b\n'), []);
});

test("keeps tool directives", () => {
  const ts = "#!/usr/bin/env node\n/// <reference types=\"x\" />\n// eslint-disable-next-line no-x\n// @ts-expect-error\n";
  assert.deepEqual(found("a.mjs", ts.replace("/// <reference types=\"x\" />\n", "")), []);
  assert.deepEqual(found("a.ts", ts.slice(ts.indexOf("\n") + 1)), []);
  assert.deepEqual(found("a.tsx", "const e = <div>{/* eslint-disable-next-line x */}<img /></div>;\n"), []);
  assert.deepEqual(found("A.java", "// CHECKSTYLE:OFF\nclass A {}\n"), []);
  assert.deepEqual(found("Dockerfile", "# syntax=docker/dockerfile:1\nFROM x\n"), []);
});

test("skips files that can't or shouldn't change", () => {
  for (const path of ["backend/src/main/resources/db/migration/V1__a.sql", "backend/src/main/resources/db/migration/x.java",
    "gradlew", "gradlew.bat", "frontend/next-env.d.ts", ".idea/misc.xml", "docs/a.feature", "README.md", ".env.example"]) {
    assert.equal(isChecked(path), false, path);
  }
  for (const path of ["frontend/app/page.tsx", "backend/src/main/java/A.java", ".github/workflows/ci.yml",
    "backend/Dockerfile", "config/checkstyle/checkstyle.xml", "frontend/app/globals.css", "build.gradle.kts"]) {
    assert.equal(isChecked(path), true, path);
  }
});

test("a comment on its own lines goes without leaving a gap", () => {
  assert.equal(strip("a.ts", "// header\n// more\n\nimport a from \"a\";\n"), "import a from \"a\";\n");
  assert.equal(strip("a.ts", "a();\n\n/**\n * doc\n */\n\nb();\n"), "a();\n\nb();\n");
  assert.equal(strip("a.ts", "if (x) {\n  a();\n\n  // why\n}\n"), "if (x) {\n  a();\n}\n");
  assert.equal(strip("A.java", "class A {\r\n    // why\r\n    int a;\r\n}\r\n"), "class A {\r\n    int a;\r\n}\r\n");
});

test("a trailing comment goes with the spaces before it", () => {
  assert.equal(strip("a.ts", "const a = 1;   // one\nconst b = 2;\n"), "const a = 1;\nconst b = 2;\n");
  assert.equal(strip("a.ts", "f(a, /* b */ c);\n"), "f(a, c);\n");
  assert.equal(strip("ci.yml", "a: 1\n# c\nb: 2\n"), "a: 1\nb: 2\n");
});

test("a JSX comment goes with its braces", () => {
  assert.equal(strip("a.tsx", "const e = (\n  <div>\n    {/* note */}\n    <p />\n  </div>\n);\n"),
    "const e = (\n  <div>\n    <p />\n  </div>\n);\n");
});
