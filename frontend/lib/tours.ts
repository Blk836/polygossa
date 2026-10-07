// First-visit tours: a few short tips the first time a new account opens each main page, each pointing at the control
// it explains (marked in the page with data-tour="<target>"). The account remembers which tours were seen; see
// components/feature-tour.tsx for the card. Pure data and helpers, unit-tested.

export interface TourStep {
  /** The data-tour name of the control this tip points at; none for a tip about the page as a whole. */
  target?: string;
  title: string;
  body: string;
}

export interface Tour {
  /** Stored on the account once seen: lower-case letters and dashes. */
  key: string;
  /** The page it belongs to; a path ending in "/" covers the pages under it (the reader's /read/12). */
  path: string;
  steps: TourStep[];
}

/** What the account says about tours: whether they're on, and which ones were already seen. */
export interface Tours {
  on: boolean;
  seen: string[];
}

export const TOURS: Tour[] = [
  {
    key: "library",
    path: "/library",
    steps: [
      { target: "import", title: "Add something to read", body: "Import a text, an e-book, subtitles or a YouTube video. It opens straight in the reader." },
      { target: "explore", title: "Or pick from Explore", body: "Texts and videos shared by other learners, sorted by level and topic." },
      { target: "language", title: "Your learning language", body: "Switch the language you're learning here. Library, Explore, Words and Review all follow it." },
    ],
  },
  {
    key: "explore",
    path: "/community",
    steps: [
      { target: "explore-search", title: "Find something at your level", body: "Search titles, pick a level, or show only texts or videos. Open any card to start reading." },
      { target: "saved", title: "Keep it for later", body: "Save a card with its bookmark and it waits for you under Saved." },
    ],
  },
  {
    key: "import",
    path: "/import",
    steps: [
      { target: "import-source", title: "Choose where it comes from", body: "Paste text, fetch a web page, upload subtitles or an e-book, or paste a YouTube link with captions in the language." },
      { target: "import-language", title: "Check the language", body: "It's the language of the text, not yours. Then import, and it opens in the reader." },
    ],
  },
  {
    key: "playlists",
    path: "/playlists",
    steps: [
      { target: "playlist-create", title: "Make a playlist", body: "Name it here, then add texts and videos with the playlist button on any card or in the reader." },
      { target: "playlist-tabs", title: "Playlists from others", body: "Shared shows playlists other learners made. Save the ones you like." },
    ],
  },
  {
    key: "reader",
    path: "/read/",
    steps: [
      { target: "reader-text", title: "Click any word", body: "You see its meaning, and it's saved as a word you're learning (yellow). Blue words are new to you." },
      { target: "reader-text", title: "Save a phrase", body: "Drag across a few words, or shift-click them, to save them together as a phrase." },
      { target: "reader-pages", title: "Turn the page when you're done", body: "The blue words you didn't click count as known. That's how your known-word count grows." },
    ],
  },
  {
    key: "review",
    path: "/review",
    steps: [
      { title: "Review before you forget", body: "Words you save come back here when they're due. Recall the meaning, show the answer, then rate how well you knew it." },
    ],
  },
  {
    key: "words",
    path: "/vocabulary",
    steps: [
      { target: "words-filters", title: "Every word you've saved", body: "Search, or filter by status, language or tag. Open a word to add notes and tags." },
      { target: "words-import", title: "Coming from LingQ or Readlang?", body: "Import your words here, so the ones you know already count as known." },
    ],
  },
  {
    key: "writing",
    path: "/writing",
    steps: [
      { title: "Test your writing", body: "Write about a short situation against the clock. AI grades it, corrects it and sets your writing level." },
    ],
  },
  {
    key: "progress",
    path: "/dashboard",
    steps: [
      { target: "streak", title: "Keep your streak", body: "A little reading, listening or review counts for the day. Set a daily goal in Settings." },
      { target: "known-words", title: "Words you know", body: "The best measure of progress. Your levels are worked out from it and from what you finish." },
    ],
  },
  {
    key: "forum",
    path: "/forum",
    steps: [
      { target: "forum-categories", title: "Talk to us", body: "Report a bug, suggest an idea or ask other learners. Pick a category, then start a thread." },
    ],
  },
];

/** The tour for this page, if it has one. */
export function tourFor(pathname: string): Tour | undefined {
  return TOURS.find((t) => (t.path.endsWith("/") ? pathname.startsWith(t.path) && pathname.length > t.path.length : pathname === t.path));
}

/** The tour to show on this page: none when tours are off, already seen, or the page has none. */
export function pendingTour(pathname: string, tours: Tours): Tour | null {
  const tour = tourFor(pathname);
  return tours.on && tour && !tours.seen.includes(tour.key) ? tour : null;
}

/** The account's tours with one more seen (at most once). */
export function withSeen(tours: Tours, key: string): Tours {
  return tours.seen.includes(key) ? tours : { ...tours, seen: [...tours.seen, key] };
}

export function stepLabel(index: number, count: number): string {
  return `${index + 1} of ${count}`;
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A control's box, or null when it's hidden (no size, e.g. display: none) or missing. */
export function visibleRect(box: Rect | null): Rect | null {
  return box && box.width > 0 && box.height > 0 ? box : null;
}

/** Same box to the pixel: the card only moves when its control does. */
export function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return a === b;
  const near = (x: number, y: number) => Math.round(x) === Math.round(y);
  return near(a.top, b.top) && near(a.left, b.left) && near(a.width, b.width) && near(a.height, b.height);
}

const MARGIN = 12;
/** Below this width the app shows the phone tab bar at the bottom. */
const PHONE = 768;

/** Bottom of the screen, centred (above the phone tab bar). */
function atBottom(card: Size, viewport: Size): { top: number; left: number } {
  const gap = viewport.width < PHONE ? 80 : 24;
  return { top: Math.max(MARGIN, viewport.height - card.height - gap), left: Math.max(MARGIN, (viewport.width - card.width) / 2) };
}

/**
 * Where the tip card goes: under its control if it fits, else over it, centred on it and kept on screen; at the
 * bottom of the screen when there's no control or no room around it.
 */
export function placeCard(target: Rect | null, card: Size, viewport: Size): { top: number; left: number } {
  if (!target) return atBottom(card, viewport);
  const below = target.top + target.height + MARGIN;
  const above = target.top - MARGIN - card.height;
  let top: number;
  if (below + card.height <= viewport.height - MARGIN) top = below;
  else if (above >= MARGIN) top = above;
  else return atBottom(card, viewport);
  const centred = target.left + target.width / 2 - card.width / 2;
  const left = Math.min(Math.max(centred, MARGIN), viewport.width - card.width - MARGIN);
  return { top, left };
}
