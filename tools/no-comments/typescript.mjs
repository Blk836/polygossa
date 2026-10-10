import { createRequire } from "node:module";

const ts = createRequire(new URL("../../frontend/package.json", import.meta.url))("typescript");

const LITERALS = new Set([
  ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail, ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.JsxText,
]);

function scriptKind(path) {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".ts") || path.endsWith(".mts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JSX;
}

function walk(source, visit) {
  const go = (node) => {
    visit(node);
    for (const child of node.getChildren(source)) go(child);
  };
  go(source);
}

function collect(source, text) {
  const found = new Map();
  const literals = [];
  const emptyJsx = [];
  const keep = (start, end) => { found.set(start, [start, end]); };
  const add = (pos) => {
    ts.forEachLeadingCommentRange(text, pos, keep);
    ts.forEachTrailingCommentRange(text, pos, keep);
  };
  walk(source, (node) => {
    const isText = node.kind === ts.SyntaxKind.JsxText;
    if (LITERALS.has(node.kind)) literals.push([isText ? node.pos : node.getStart(source), node.end]);
    if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) {
      emptyJsx.push([node.getStart(source), node.end]);
      add(node.getStart(source) + 1);
    }
    if (!isText) add(node.pos);
    add(node.end);
  });
  add(source.endOfFileToken.pos);
  return { found: [...found.values()], literals, emptyJsx };
}

const inside = ([start, end], [outerStart, outerEnd]) => start >= outerStart && end <= outerEnd;

export function scanTypeScript(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(path));
  const { found, literals, emptyJsx } = collect(source, text);
  return found
    .filter((range) => !literals.some((literal) => inside(range, literal)))
    .map((range) => {
      const wrapper = emptyJsx.find((jsx) => inside(range, jsx));
      return wrapper && text.slice(wrapper[0] + 1, wrapper[1] - 1).trim() === text.slice(...range) ? wrapper : range;
    })
    .sort((a, b) => a[0] - b[0]);
}
