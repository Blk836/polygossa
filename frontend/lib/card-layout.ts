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

export function cardLayoutCookie(layout: CardLayout): string {
  const attrs = "Path=/; Max-Age=" + (layout === "cards" ? 0 : ONE_YEAR_SECONDS) + "; SameSite=Lax";
  return `${CARD_LAYOUT_COOKIE}=${layout === "cards" ? "" : layout}; ${attrs}`;
}

const GRID_CLASSES: Record<CardLayout, string> = {
  cards: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  compact: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  list: "flex flex-col gap-2",
};

export function cardGridClass(layout: CardLayout): string {
  return GRID_CLASSES[layout];
}

export function shelfCardLayout(layout: CardLayout): CardLayout {
  return layout;
}

const SHELF_WIDTHS: Record<CardLayout, string> = { cards: "w-64", compact: "w-44", list: "min-w-0" };

export function shelfCardWidth(layout: CardLayout): string {
  return SHELF_WIDTHS[layout];
}

const SHELF_LINE = "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0";
const SHELF_ROWS = ["grid-rows-1", "grid-rows-2", "grid-rows-3"];

export function shelfTrackClass(layout: CardLayout, items: number): string {
  if (layout !== "list") return SHELF_LINE;
  const rows = SHELF_ROWS[Math.min(Math.max(items, 1), SHELF_ROWS.length) - 1];
  return `-mx-4 grid grid-flow-col auto-cols-[min(24rem,calc(100vw-3rem))] ${rows} snap-x snap-mandatory gap-x-4 gap-y-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0`;
}
