"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";

interface MeContextValue {
  me: Me;
  isPro: boolean;
  refresh: () => Promise<void>;
  setMe: (me: Me) => void;
}

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ initial, children }: { initial: Me; children: ReactNode }) {
  const [me, setMe] = useState(initial);
  const refresh = useCallback(async () => setMe(await api<Me>("me")), []);
  return (
    <MeContext.Provider value={{ me, isPro: me.plan.effectiveTier !== "FREE", refresh, setMe }}>
      {children}
    </MeContext.Provider>
  );
}

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside MeProvider");
  return ctx;
}
