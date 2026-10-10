export interface TourStep {
  target?: string;
  title: string;
  body: string;
}

export interface Tour {
  key: string;
  path: string;
  needs?: (keyof Access)[];
  steps: TourStep[];
}

export interface Access {
  pro: boolean;
  language: boolean;
}

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
      { target: "my-library", title: "Keep it for later", body: "Save a card with its bookmark and it waits for you in My library." },
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
      { target: "explore", title: "Playlists from others", body: "Search Explore to find playlists other learners shared. The ones you save show up here." },
    ],
  },
  {
    key: "reader",
    path: "/read/",
    steps: [
      { target: "reader-text", title: "Click any word", body: "You see its meaning, and it's saved as a word you're learning (yellow). Blue words are new to you." },
      { target: "reader-text", title: "Save a phrase", body: "Drag across a few words, or shift-click them, to save them together as a phrase." },
      { target: "reader-next", title: "Turn the page when you're done", body: "Turning the page (or Finish lesson) counts the blue words you didn't click as known. That's how your known words grow." },
    ],
  },
  {
    key: "review",
    path: "/review",
    needs: ["pro"],
    steps: [
      { target: "review-goal", title: "Review before you forget", body: "Words you save come back here when they're due. A few each day reach your daily goal and keep your streak going." },
      { target: "review-card", title: "Recall, then rate", body: "Try to recall the meaning, show the answer, then rate how well you knew it. Words you know well come back less often." },
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
    needs: ["pro", "language"],
    steps: [
      { target: "writing-start", title: "Test your writing", body: "Write about a short situation against the clock. AI grades it, corrects it and sets your writing level." },
    ],
  },
  {
    key: "progress",
    path: "/dashboard",
    steps: [
      { target: "streak", title: "Keep your streak", body: "A little reading, listening or review each day keeps it going. Change your daily goal right beside it." },
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

export function tourFor(pathname: string): Tour | undefined {
  return TOURS.find((t) => (t.path.endsWith("/") ? pathname.startsWith(t.path) && pathname.length > t.path.length : pathname === t.path));
}

export function pendingTour(pathname: string, tours: Tours, access: Access): Tour | null {
  const tour = tourFor(pathname);
  if (!tours.on || !tour || tours.seen.includes(tour.key)) return null;
  return (tour.needs ?? []).every((need) => access[need]) ? tour : null;
}

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

export function visibleRect(box: Rect | null): Rect | null {
  return box && box.width > 0 && box.height > 0 ? box : null;
}

export function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return a === b;
  const near = (x: number, y: number) => Math.round(x) === Math.round(y);
  return near(a.top, b.top) && near(a.left, b.left) && near(a.width, b.width) && near(a.height, b.height);
}

const MARGIN = 12;
const PHONE = 768;

function atBottom(card: Size, viewport: Size): { top: number; left: number } {
  const gap = viewport.width < PHONE ? 80 : 24;
  return { top: Math.max(MARGIN, viewport.height - card.height - gap), left: Math.max(MARGIN, (viewport.width - card.width) / 2) };
}

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
