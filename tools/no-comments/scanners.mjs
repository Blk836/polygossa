function skipQuoted(text, i, quote) {
  let j = i + 1;
  while (j < text.length && text[j] !== quote && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
  return j + 1;
}

function skipTextBlock(text, i) {
  const close = text.indexOf('"""', i + 3);
  return close === -1 ? text.length : close + 3;
}

function lineEnd(text, i) {
  const newline = text.indexOf("\n", i);
  const end = newline === -1 ? text.length : newline;
  return text[end - 1] === "\r" ? end - 1 : end;
}

function blockEnd(text, i) {
  const close = text.indexOf("*/", i + 2);
  return close === -1 ? text.length : close + 2;
}

function step(text, i, lineComments) {
  if (text.startsWith('"""', i)) return { next: skipTextBlock(text, i) };
  if (text[i] === '"' || text[i] === "'") return { next: skipQuoted(text, i, text[i]) };
  if (lineComments && text.startsWith("//", i)) return { comment: [i, lineEnd(text, i)] };
  if (text.startsWith("/*", i)) return { comment: [i, blockEnd(text, i)] };
  return { next: i + 1 };
}

export function scanCLike(text, { lineComments = true } = {}) {
  const ranges = [];
  let i = 0;
  while (i < text.length) {
    const { next, comment } = step(text, i, lineComments);
    if (comment) ranges.push(comment);
    i = comment ? comment[1] : next;
  }
  return ranges;
}

export function scanHash(text) {
  const ranges = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const indent = line.length - line.trimStart().length;
    if (line.trimStart().startsWith("#")) ranges.push([offset + indent, offset + line.replace(/\r$/, "").length]);
    offset += line.length + 1;
  }
  return ranges;
}

export function scanXml(text) {
  const ranges = [];
  let i = text.indexOf("<!--");
  while (i !== -1) {
    const close = text.indexOf("-->", i + 4);
    const end = close === -1 ? text.length : close + 3;
    ranges.push([i, end]);
    i = text.indexOf("<!--", end);
  }
  return ranges;
}
