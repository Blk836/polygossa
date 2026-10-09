import { scanCLike, scanHash, scanXml } from "./scanners.mjs";
import { scanTypeScript } from "./typescript.mjs";

const SKIPPED = [
  /^docs\//, /\.md$/, /\.feature$/, /^\.idea\//, /(^|\/)next-env\.d\.ts$/, /\/db\/migration\//,
  /^gradlew(\.bat)?$/, /^gradle\/wrapper\//, /^\.env\.example$/,
];

const SCANNERS = [
  [/\.(ts|tsx|mts|mjs|js|cjs|jsx)$/, scanTypeScript],
  [/\.(java|kts)$/, (_, text) => scanCLike(text)],
  [/\.css$/, (_, text) => scanCLike(text, { lineComments: false })],
  [/\.xml$/, (_, text) => scanXml(text)],
  [/(\.(ya?ml|properties|ps1|gitignore|gitattributes|dockerignore|development)|(^|\/)Dockerfile)$/,
    (_, text) => scanHash(text)],
];

const DIRECTIVE = new RegExp([
  String.raw`^\{?\/[/*]\s*(eslint|@ts-|global\s|Stryker|CHECKSTYLE)`,
  String.raw`^\/\/\/\s*<reference`,
  String.raw`^#!`,
  String.raw`^#\s*(syntax|escape|check)=`,
].join("|"));

function scannerFor(path) {
  const match = SKIPPED.some((pattern) => pattern.test(path)) ? null : SCANNERS.find(([pattern]) => pattern.test(path));
  return match ? match[1] : null;
}

export const isChecked = (path) => scannerFor(path) !== null;

export function commentsIn(path, text) {
  const scan = scannerFor(path);
  if (!scan) return [];
  return scan(path, text).filter(([start, end]) => !DIRECTIVE.test(text.slice(start, end)));
}

export function lineOf(text, offset) {
  return text.slice(0, offset).split("\n").length;
}
