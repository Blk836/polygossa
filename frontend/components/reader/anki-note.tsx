"use client";

import { useEffect, useState } from "react";
import { useMe } from "../me-context";
import { api } from "@/lib/api";
import type { AnkiWordLink } from "@/lib/anki-types";
import type { LanguageCode, WordStatus } from "@/lib/types";

export function ankiNoteText(link: AnkiWordLink | null, status: WordStatus | undefined): string | null {
  if (!link?.promoted) return null;
  if (status === "known") return "Known through Anki";
  if (link.state === "mature") return "Anki won't change this back until its card changes in Anki.";
  return null;
}

export function AnkiNote({ language, term, status }: { language: LanguageCode; term: string; status: WordStatus | undefined }) {
  const { me } = useMe();
  const [link, setLink] = useState<AnkiWordLink | null>(null);
  useEffect(() => {
    if (!me.ankiConnected) return;
    let cancelled = false;
    const params = new URLSearchParams({ language, term });
    api<AnkiWordLink | null>(`anki/word?${params}`).then((r) => !cancelled && setLink(r)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [me.ankiConnected, language, term]);
  const text = ankiNoteText(link, status);
  return text ? <p className="text-xs text-muted" data-testid="anki-note">{text}</p> : null;
}
