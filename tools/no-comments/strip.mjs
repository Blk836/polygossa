function lineStart(text, i) {
  return text.lastIndexOf("\n", i - 1) + 1;
}

function nextLineStart(text, i) {
  const newline = text.indexOf("\n", i);
  return newline === -1 ? text.length : newline + 1;
}

const blank = (line) => line.trim() === "";
const closes = (line) => /^\s*(\}|\)|\]|<\/)/.test(line);

function lineAt(text, start) {
  return text.slice(start, nextLineStart(text, start)).replace(/\r?\n$/, "");
}

function dropLines(text, from, to) {
  let start = from;
  let end = to;
  const previous = start === 0 ? null : lineAt(text, lineStart(text, start - 1));
  const following = end < text.length ? lineAt(text, end) : null;
  const previousBlank = previous === null || blank(previous);
  if (previousBlank && following !== null && blank(following)) end = nextLineStart(text, end);
  else if (previous !== null && blank(previous) && following !== null && closes(following)) {
    start = lineStart(text, start - 1);
  }
  return text.slice(0, start) + text.slice(end);
}

function removeOne(text, [start, end]) {
  const from = lineStart(text, start);
  const lineEnd = nextLineStart(text, end);
  const before = text.slice(from, start);
  const after = text.slice(end, lineEnd).replace(/\r?\n$/, "");
  if (blank(before) && blank(after)) return dropLines(text, from, lineEnd);
  if (blank(after)) return text.slice(0, from) + before.trimEnd() + text.slice(end + after.length);
  if (blank(before)) return text.slice(0, start) + text.slice(end).replace(/^[ \t]+/, "");
  return text.slice(0, start).replace(/[ \t]+$/, " ") + text.slice(end).replace(/^[ \t]+/, "");
}

export function removeRanges(text, ranges) {
  const sorted = [...ranges].sort((a, b) => b[0] - a[0]);
  return sorted.reduce(removeOne, text);
}
