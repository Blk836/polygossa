import type { Dock } from "./reader-fit";

export function fixedDocks(): Dock[] {
  return [...document.querySelectorAll<HTMLElement>("[data-bottom-bar], [data-floating-player]")]
    .filter((el) => getComputedStyle(el).position === "fixed")
    .map((el) => el.getBoundingClientRect());
}
