"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { ReaderPlaylist } from "@/lib/playlist-types";
import type { DictionaryResult, TextDetail, WordStatus } from "@/lib/types";
import { useMe } from "../me-context";
import { ErrorNote } from "../ui";
import { AudioPanel } from "./audio-panel";
import { FinishPanel } from "./finish-panel";
import { Paragraph } from "./paragraph";
import { ReaderHeader } from "./reader-header";
import { pageRange, unseenOnPage } from "./reader-pages";
import { ReaderPager } from "./reader-pager";
import { articleClass, audioToggle, layoutClass, mediaState, onPage, pageNote, PhraseHint } from "./reader-parts";
import { ReaderPopup } from "./reader-popup";
import type { ReaderSettings } from "./reader-settings";
import { overlapping, phraseMarks, readerStats, sentenceTexts, toParagraphs } from "./reader-text";
import { transcriptParagraphs } from "./reader-transcript";
import { TextMeasure } from "./text-measure";
import type { MediaHandle } from "./use-media-player";
import { usePageKnown } from "./use-page-known";
import { useFitPages, useMeasuring } from "./use-fit-pages";
import { usePageTurns } from "./use-page-turns";
import { useMediaShortcuts, useReaderInput } from "./use-reader-input";
import { useReaderPages } from "./use-reader-pages";
import { usePopupOpeners, usePopupState } from "./use-reader-popup";
import { useReaderSettings } from "./use-reader-settings";
import { useReadingSession } from "./use-reading-session";
import { useVocabularyStatus } from "./use-vocabulary-status";
import { VideoPanel } from "./video-panel";

/**
 * The reader, the same for texts, audio texts and videos: header, paged text with the word popup, and (with audio
 * or video) one bottom player bar. Videos add the player itself, beside the text on wide screens.
 */
export function Reader({ initial, initialSettings, playlist }: {
  initial: TextDetail;
  initialSettings: ReaderSettings;
  /** The playlist the text was opened from (`?playlist=`), if any. */
  playlist: ReaderPlaylist | null;
}) {
  const { me, isPro, refresh } = useMe();
  const { text, tokens, video } = initial;
  const language = text.language;

  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState(initial.audio);
  const [showAudio, setShowAudio] = useState(!!initial.audio);
  const [active, setActive] = useState<number | null>(null);
  const [finished, setFinished] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const { settings, update: updateSettings } = useReaderSettings(initialSettings);

  const articleRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaHandle>(null);
  const session = useReadingSession(text.id);
  const onSaved = useCallback(() => void refresh(), [refresh]);
  const popup = usePopupState(articleRef);
  const { sel, target, place, close } = popup;
  const vocab = useVocabularyStatus({
    language,
    textId: text.id,
    initialStatuses: initial.statuses,
    initialPhrases: initial.phrases,
    onSaved,
    onNotice: popup.setNotice,
    onError: setError,
  });
  const { autoSave, recordDefinition, setStatus: setVocabStatus, markRemainingKnown } = vocab;

  const sentences = useMemo(() => sentenceTexts(tokens), [tokens]);
  // Captions put a few words on each line; transcripts flow them into paragraphs instead.
  const paragraphs = useMemo(() => (video ? transcriptParagraphs(tokens) : toParagraphs(tokens)), [tokens, video]);
  const measuring = useMeasuring();
  const fitted = useFitPages(paragraphs, measureRef, articleRef, measuring);
  const paging = useReaderPages(text.id, tokens, paragraphs, fitted, text.progress?.position ?? null);
  const { page, pages, goTo, goToToken } = paging;
  const marks = useMemo(() => phraseMarks(tokens, vocab.phrases), [tokens, vocab.phrases]);
  const stats = useMemo(() => readerStats(tokens, vocab.statuses), [tokens, vocab.statuses]);
  const unseenHere = useMemo(() => unseenOnPage(paging.paragraphs, vocab.statuses), [paging.paragraphs, vocab.statuses]);

  // Paused media waits at the start of the page shown (none on page 1) until first played or seeked.
  const cueToken = page > 1 ? (pageRange(paging.paragraphs)?.from ?? null) : null;

  const { reveal, turnPage } = usePageTurns({ page, goTo, goToToken, articleRef, place, close, active });
  const markPageKnown = usePageKnown({ textId: text.id, statuses: vocab.statuses, markRemainingKnown, onSaved, onError: setError });

  /** Pager and ←/→: turning forward first marks the page's new words known, if that setting is on. */
  const changePage = useCallback(
    (n: number) => {
      if (settings.pageKnown && n === page + 1 && n <= paging.count) markPageKnown(paging.paragraphs);
      turnPage(n);
    },
    [settings.pageKnown, page, paging.count, paging.paragraphs, markPageKnown, turnPage],
  );

  const onOpen = useCallback(() => {
    if (settings.pauseOnLookup) mediaRef.current?.pause();
  }, [settings.pauseOnLookup]);
  const revealPopup = useCallback((i: number) => reveal(i, "nearest", true), [reveal]);
  const { openWord, openPhrase } = usePopupOpeners({ tokens, sentences, popup, reveal: revealPopup, autoSave, onError: setError, onOpen });

  const setStatus = useCallback(
    (status: WordStatus | null) => {
      if (target) void setVocabStatus(target, status);
    },
    [target, setVocabStatus],
  );
  const onDefinition = useCallback(
    (result: DictionaryResult) => {
      if (target) recordDefinition(target, result);
    },
    [target, recordDefinition],
  );
  const saveSentence = useCallback(
    async (translation?: string) => {
      if (!target) return;
      await api("sentences", { body: { language, sentence: target.sentence, translation, textId: text.id } });
    },
    [target, language, text.id],
  );

  // A popup whose word is on another page (audio turned the page) stays hidden until that page is back.
  const shown = onPage(target, pages, page);
  const input = useReaderInput({
    tokens, sel, setSel: popup.setSel, popup: shown && shown.kind, phraseMode: popup.phraseMode, openWord, openPhrase, setStatus, close,
    articleRef, popupRef, turnPage: (dir) => changePage(page + dir),
  });
  const media = mediaState(!!video, audio, showAudio);
  useMediaShortcuts(media.shortcuts ? (action) => mediaRef.current?.shortcut(action) : null);

  const jumpToToken = useCallback(
    (i: number) => {
      setActive(i);
      reveal(i, "center", false, "replace");
    },
    [reveal],
  );

  async function finish() {
    setFinishing(true);
    setError(null);
    try {
      const r = await api<{ markedKnown: number }>(`texts/${text.id}/complete`, { method: "POST" });
      await session.complete();
      markRemainingKnown(tokens);
      setFinished(r.markedKnown);
      void refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setFinishing(false);
    }
  }

  function playFromHere() {
    if (!target) return;
    if (!video) setShowAudio(true);
    mediaRef.current?.playFromToken(target.startToken);
  }

  const isOwner = text.owner.id === me.id;
  const audioButton = audioToggle(audio, isOwner, !!video, showAudio, () => setShowAudio(!showAudio));

  return (
    <div className={layoutClass(!!video, media.playerBar)}>
      <div className="min-w-0 lg:col-start-1">
        <ReaderHeader text={text} playlist={playlist} stats={stats} settings={settings} onSettings={updateSettings} audio={audioButton} media={media.shortcuts} />
      </div>
      <VideoPanel ref={mediaRef} video={video} tokens={tokens} onActiveToken={setActive} onJumpToToken={jumpToToken} cueToken={cueToken} />

      <div className="min-w-0 lg:col-start-1">
        <ErrorNote message={error} />
        <PhraseHint show={popup.phraseMode} />
        <div ref={articleRef} className="relative">
          <article
            className={articleClass(language, settings.size, settings.quiet)}
            lang={language}
            onPointerDown={input.onPointerDown}
            onPointerOver={input.onPointerOver}
            onClick={input.onClick}
          >
            {paging.paragraphs.map((p, k) => (
              <Paragraph key={k} tokens={p} statuses={vocab.statuses} phrases={marks} {...overlapping(p, sel, active)} />
            ))}
          </article>

          {measuring && <TextMeasure ref={measureRef} paragraphs={paragraphs} className={articleClass(language, settings.size, false)} />}

          <ReaderPopup
              ref={popupRef}
              target={shown}
              anchor={popup.anchor}
              language={language}
              speechLocale={initial.speechLocale}
              status={vocab.statusOf(shown)}
              isPro={isPro}
              notice={popup.notice}
              hasAudio={media.synced}
              onStatus={setStatus}
              onDefinition={onDefinition}
              onSaveSentence={saveSentence}
              onPlayFromHere={playFromHere}
              onLookupLemma={popup.lookupLemma}
              onPhraseMode={() => popup.setPhraseMode(true)}
              onClose={close}
            />
        </div>

        <ReaderPager
          page={page} count={paging.count} onPage={changePage} className="mt-3"
          note={pageNote(settings.pageKnown, page, paging.count, unseenHere)}
        />

        <FinishPanel
          visible={page >= paging.count} textId={text.id} language={language} isPro={isPro} unseen={stats.unseen}
          learning={stats.learning} finished={finished} finishing={finishing} onFinish={finish} playlist={playlist}
        />
      </div>

      {media.audioPanel && (
        <AudioPanel
          ref={mediaRef}
          textId={text.id}
          audio={audio}
          tokens={tokens}
          isOwner={isOwner}
          isPro={isPro}
          onActiveToken={setActive}
          onJumpToToken={jumpToToken}
          onAudioChanged={setAudio}
          cueToken={cueToken}
          onClose={() => {
            setShowAudio(false);
            setActive(null);
          }}
        />
      )}
    </div>
  );
}
