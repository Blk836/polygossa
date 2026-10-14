export const POPUP_GAP = 8;

export interface Span {
  top: number;
  bottom: number;
}

export function popupTop(word: Span, height: number, view: Span): number {
  const below = word.bottom + POPUP_GAP;
  if (below + height <= view.bottom) return below;
  const above = word.top - POPUP_GAP - height;
  if (above >= view.top) return above;
  return Math.max(view.top, view.bottom - height);
}

export function popupLeft(wordLeft: number, width: number, columnWidth: number): number {
  return Math.max(0, Math.min(wordLeft, columnWidth - width));
}
