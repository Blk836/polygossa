// How Library and Explore lay out texts and videos: big cards (the default), compact cards that pack more on screen,
// or a list of rows. Kept in a cookie, like the theme, so the server renders the chosen layout on the first paint.

export type CardLayout = "cards" | "compact" | "list";

export const CARD_LAYOUT_COOKIE = "lector_card_layout";

export const CARD_LAYOUTS: { value: CardLayout; label: string }[] = [
  { value: "cards", label: "Cards" },
  { value: "compact", label: "Compact" },
  { value: "list", label: "List" },
];

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function parseCardLayout(value: string | null | undefined): CardLayout {
  return value === "compact" || value === "list" ? value : "cards";
}

/** A `document.cookie` assignment that stores the layout (or clears it for the default cards). */
export function cardLayoutCookie(layout: CardLayout): string {
  const attrs = "Path=/; Max-Age=" + (layout === "cards" ? 0 : ONE_YEAR_SECONDS) + "; SameSite=Lax";
  return `${CARD_LAYOUT_COOKIE}=${layout === "cards" ? "" : layout}; ${attrs}`;
}

const GRID_CLASSES: Record<CardLayout, string> = {
  cards: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  compact: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  list: "flex flex-col gap-2",
};

/** Classes for the container that holds a page of cards. */
export function cardGridClass(layout: CardLayout): string {
  return GRID_CLASSES[layout];
}

/** Explore's shelves scroll sideways, where rows make no sense: the list layout shows compact cards there. */
export function shelfCardLayout(layout: CardLayout): "cards" | "compact" {
  return layout === "cards" ? "cards" : "compact";
}

/** Width of one card on a shelf. */
export function shelfCardWidth(layout: CardLayout): string {
  return shelfCardLayout(layout) === "cards" ? "w-64" : "w-44";
}
