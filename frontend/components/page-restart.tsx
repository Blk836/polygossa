"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";

interface PageRestart {
  run: number;
  restart: (search: string) => void;
  hold: () => () => void;
}

const PageRestartContext = createContext<PageRestart>({ run: 0, restart: () => {}, hold: () => () => {} });

export function PageRestartProvider({ children }: { children: ReactNode }) {
  const search = useSearchParams().toString();
  const [state, setState] = useState<{ run: number; at: string | null }>({ run: 0, at: null });
  if (state.at !== null && state.at === search) setState({ run: state.run + 1, at: null });
  const holds = useRef(0);
  const restart = useCallback((target: string) => {
    if (holds.current > 0) return;
    setState((s) => (target === search ? { run: s.run + 1, at: null } : { ...s, at: target }));
    window.scrollTo(0, 0);
  }, [search]);
  const hold = useCallback(() => {
    holds.current += 1;
    return () => {
      holds.current -= 1;
    };
  }, []);
  const value = useMemo(() => ({ run: state.run, restart, hold }), [state.run, restart, hold]);
  return <PageRestartContext.Provider value={value}>{children}</PageRestartContext.Provider>;
}

export function RestartablePage({ children }: { children: ReactNode }) {
  const { run } = useContext(PageRestartContext);
  return <Fragment key={run}>{children}</Fragment>;
}

export function useRestartOnSamePage(): (href: string) => (e: MouseEvent<HTMLAnchorElement>) => void {
  const pathname = usePathname();
  const { restart } = useContext(PageRestartContext);
  return (href) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const target = new URL(href, window.location.href);
    if (target.pathname === pathname) restart(target.searchParams.toString());
  };
}

export function useHoldPage() {
  const { hold } = useContext(PageRestartContext);
  useEffect(() => hold(), [hold]);
}
