"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { beacon } from "@/lib/api";
import type { Token } from "@/lib/types";
import { pageOfToken, pageRange, resolvePage, toPages, type ReaderPage } from "./reader-pages";

const storageKey = (textId: number) => `lector_page_${textId}`;

function readSaved(textId: number): string | null {
  try {
    return window.localStorage.getItem(storageKey(textId));
  } catch {
    return null;
  }
}

function writeSaved(textId: number, page: number) {
  try {
    window.localStorage.setItem(storageKey(textId), String(page));
  } catch {
  }
}

function setUrlPage(page: number, mode: "push" | "replace") {
  const params = new URLSearchParams(window.location.search);
  params.set("page", String(page));
  const url = `?${params.toString()}${window.location.hash}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

export function useReaderPages(
  textId: number,
  tokens: Token[],
  paragraphs: Token[][],
  fitted: ReaderPage[] | null,
  savedToken: number | null,
) {
  const pages = useMemo(() => fitted ?? toPages(tokens, paragraphs), [fitted, tokens, paragraphs]);
  const fromUrl = useSearchParams().get("page");
  const page = resolvePage(fromUrl, null, pages.length);
  const count = pages.length;

  const anchor = useRef<{ pages: ReaderPage[]; fitted: boolean; token: number } | null>(null);
  useEffect(() => {
    const a = anchor.current;
    if (a && a.fitted && a.pages !== pages) {
      const target = pageOfToken(pages, a.token);
      if (target !== page) return setUrlPage(target, "replace");
    }
    anchor.current = { pages, fitted: fitted !== null, token: pageRange(pages[page - 1] ?? [])?.from ?? 0 };
  }, [pages, page, fitted]);

  const [resumeTo, setResumeTo] = useState<number | null>(null);
  useEffect(() => {
    if (resumeTo !== null) return;
    if (fromUrl === null && savedToken !== null && !fitted) return;
    const timer = window.setTimeout(() => {
      if (fromUrl !== null) return setResumeTo(resolvePage(fromUrl, null, count));
      const target = savedToken !== null ? pageOfToken(pages, savedToken) : resolvePage(null, readSaved(textId), count);
      setResumeTo(target);
      if (target > 1) setUrlPage(target, "replace");
    });
    return () => window.clearTimeout(timer);
  }, [resumeTo, fromUrl, savedToken, fitted, pages, textId, count]);

  const reached = useRef(false);
  const from = pageRange(pages[page - 1] ?? [])?.from ?? null;
  useEffect(() => {
    if (resumeTo === null || (!reached.current && page !== resumeTo)) return;
    reached.current = true;
    writeSaved(textId, page);
  }, [resumeTo, textId, page]);
  useEffect(() => {
    if (!reached.current || !fitted || from === null) return;
    beacon(`texts/${textId}/progress`, { position: from });
  }, [resumeTo, page, fitted, textId, from]);

  const goTo = useCallback(
    (n: number, mode: "push" | "replace" = "push") => {
      const next = Math.max(1, Math.min(count, n));
      if (next === page) return false;
      setUrlPage(next, mode);
      return true;
    },
    [count, page],
  );

  const goToToken = useCallback(
    (index: number, mode: "push" | "replace" = "push") => goTo(pageOfToken(pages, index), mode),
    [goTo, pages],
  );

  return { pages, page, count, paragraphs: pages[page - 1] ?? [], goTo, goToToken };
}
