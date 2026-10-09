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

function dropLines(text, start, end) {
  const previous = start === 0 ? "" : lineAt(text, lineStart(text, start - 1));
  const following = end < text.length ? lineAt(text, end) : null;
  if (!blank(previous) || following === null) return text.slice(0, start) + text.slice(end);
  if (blank(following)) return text.slice(0, start) + text.slice(nextLineStart(text, end));
  const from = closes(following) && start > 0 ? lineStart(text, start - 1) : start;
  return text.slice(0, from) + text.slice(end);
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
