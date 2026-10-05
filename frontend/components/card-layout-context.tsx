"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cardLayoutCookie, type CardLayout } from "@/lib/card-layout";

interface CardLayoutState {
  layout: CardLayout;
  setLayout: (layout: CardLayout) => void;
}

const CardLayoutContext = createContext<CardLayoutState | null>(null);

/** Holds the Library/Explore layout the server rendered with (from the cookie); changes apply instantly everywhere. */
export function CardLayoutProvider({ initial, children }: { initial: CardLayout; children: ReactNode }) {
  const [layout, setLayoutState] = useState(initial);

  const setLayout = useCallback((next: CardLayout) => {
    document.cookie = cardLayoutCookie(next);
    setLayoutState(next);
  }, []);

  const value = useMemo(() => ({ layout, setLayout }), [layout, setLayout]);
  return <CardLayoutContext.Provider value={value}>{children}</CardLayoutContext.Provider>;
}

export function useCardLayout(): CardLayoutState {
  const ctx = useContext(CardLayoutContext);
  if (!ctx) throw new Error("useCardLayout must be used inside CardLayoutProvider");
  return ctx;
}
