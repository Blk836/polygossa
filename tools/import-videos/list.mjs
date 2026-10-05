// The list file: one video per line, "<YouTube URL> [language] [category]". "#" starts a comment (a whole line, or
// after whitespace at the end of one), so a results file can be fed back in as a list.

const ID = "[A-Za-z0-9_-]{11}";
const FORMS = [
  new RegExp(`^(?:https?://)?(?:www\\.|m\\.)?youtube\\.com/watch\\?(?:.*&)?v=(${ID})(?:[&#]|$)`),
  new RegExp(`^(?:https?://)?(?:www\\.|m\\.)?youtube\\.com/(?:shorts|embed|live)/(${ID})(?:[/?#]|$)`),
  new RegExp(`^(?:https?://)?youtu\\.be/(${ID})(?:[/?#]|$)`),
];

/** The video id in any YouTube video URL form, or null. */
export function videoId(url) {
  for (const form of FORMS) {
    const match = form.exec(url);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Parses a list file into entries {line, url, language, category}, or {line, url, error} for a line that can't be
 * imported. `languages` and `categories` are the codes the backend accepts.
 */
export function parseList(text, { languages, categories, defaultLanguage = null }) {
  const entries = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const words = raw.replace(/(^|\s)#.*$/, "").split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      entries.push(parseLine(index + 1, words, { languages, categories, defaultLanguage }));
    }
  });
  return entries;
}

function parseLine(line, [url, ...rest], options) {
  if (videoId(url) === null) {
    return { line, url, error: "not a YouTube video link" };
  }
  const found = { language: [], category: [] };
  for (const word of rest) {
    const kind = kindOf(word.toLowerCase(), options);
    if (kind === null) {
      return { line, url, error: `unknown language or category "${word}"` };
    }
    found[kind].push(word.toLowerCase());
  }
  const error = problem(found, options.defaultLanguage);
  if (error) {
    return { line, url, error };
  }
  return { line, url, language: found.language[0] ?? options.defaultLanguage, category: found.category[0] ?? null };
}

function kindOf(word, { languages, categories }) {
  if (languages.includes(word)) {
    return "language";
  }
  return categories.includes(word) ? "category" : null;
}

function problem({ language, category }, defaultLanguage) {
  if (language.length > 1) {
    return `more than one language (${quoted(language)})`;
  }
  if (category.length > 1) {
    return `more than one category (${quoted(category)})`;
  }
  return language.length === 0 && !defaultLanguage ? "no language: add one to the line or pass --language" : null;
}

const quoted = (words) => words.map((w) => `"${w}"`).join(", ");
