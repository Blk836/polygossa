"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { ReaderPlaylist } from "@/lib/playlist-types";
import type { TextDetail, WordLookup, WordStatus } from "@/lib/types";
import { useMe } from "../me-context";
import { expectPolly, sendPollyFrom } from "../polly-flight";
import { ErrorNote } from "../ui";
import { AudioPanel } from "./audio-panel";
import { FinishPanel } from "./finish-panel";
import { FollowMarker } from "./follow-along";
import { slideBudgets } from "./follow-marker";
import type { Spoken } from "./media-nav";
import { Paragraph } from "./paragraph";
import { ReaderHeader } from "./reader-header";
import { pageOfToken, pageRange, unseenOnPage } from "./reader-pages";
import { PageArrows, ReaderPager } from "./reader-pager";
import { articleClass, audioToggle, layoutProps, mediaState, onPage, pageNote, PhraseHint, showsMarker } from "./reader-parts";
import { ReaderPopup } from "./reader-popup";
import { followsSentence, followsWord, type ReaderSettings } from "./reader-settings";
import { learningEdges, learningGaps, nextWord, overlapping, phraseMarks, phraseSpans, readerStats, savedPhraseAt, sentenceHere, sentenceTexts, toParagraphs } from "./reader-text";
import { transcriptParagraphs } from "./reader-transcript";
import { TextMeasure } from "./text-measure";
import { NOTHING_SPOKEN, type MediaHandle } from "./use-media-player";
import { usePageKnown } from "./use-page-known";
import { useFitPages, useMeasuring } from "./use-fit-pages";
import { usePageTurns } from "./use-page-turns";
import { useMediaShortcuts, useReaderInput } from "./use-reader-input";
import { useReaderPages } from "./use-reader-pages";
import { usePopupOpeners, usePopupState } from "./use-reader-popup";
import { useReaderSettings } from "./use-reader-settings";
import { ListenContext, useReadingSession } from "./use-reading-session";
import { useVocabularyStatus } from "./use-vocabulary-status";
import { VideoPanel } from "./video-panel";

const flyFromWord = ({ startToken }: { startToken: number }, saved: boolean) =>
  saved ? sendPollyFrom(document.querySelector(`article [data-i="${startToken}"]`)) : expectPolly();

export function Reader({ initial, initialSettings, playlist }: {
  initial: TextDetail;
  initialSettings: ReaderSettings;
  playlist: ReaderPlaylist | null;
}) {
  const { me, isPro, refresh } = useMe();
  const { text, tokens, video } = initial;
  const language = text.language;

  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState(initial.audio);
  const [showAudio, setShowAudio] = useState(!!initial.audio);
  const [spoken, setSpoken] = useState<Spoken>(NOTHING_SPOKEN);
  const active = spoken.token;
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
    onKnownWord: flyFromWord,
    onNotice: popup.setNotice,
    onError: setError,
  });
  const { autoSave, recordLookup, pickMeaning, setStatus: setVocabStatus, markRemainingKnown } = vocab;

  const sentences = useMemo(() => sentenceTexts(tokens), [tokens]);
  const paragraphs = useMemo(() => (video ? transcriptParagraphs(tokens) : toParagraphs(tokens)), [tokens, video]);
  const measuring = useMeasuring();
  const { pages: fitted, videoMax } = useFitPages(paragraphs, measureRef, articleRef, measuring, settings.video);
  const paging = useReaderPages(text.id, tokens, paragraphs, fitted, text.progress?.position ?? null);
  const { page, pages, goTo, goToToken } = paging;
  const budgets = useMemo(() => slideBudgets(audio?.timings ?? video?.timings ?? []), [audio, video]);
  const nextOf = useCallback((i: number) => nextWord(tokens, i, 1), [tokens]);
  const spans = useMemo(() => phraseSpans(tokens, vocab.phrases), [tokens, vocab.phrases]);
  const marks = useMemo(() => phraseMarks(tokens, vocab.phrases), [tokens, vocab.phrases]);
  const gaps = useMemo(() => learningGaps(tokens, spans), [tokens, spans]);
  const edges = useMemo(() => learningEdges(spans), [spans]);
  const phraseAt = useCallback((i: number) => savedPhraseAt(spans, i), [spans]);
  const stats = useMemo(() => readerStats(tokens, vocab.statuses), [tokens, vocab.statuses]);
  const unseenHere = useMemo(() => unseenOnPage(paging.paragraphs, vocab.statuses), [paging.paragraphs, vocab.statuses]);

  const cueToken = page > 1 ? (pageRange(paging.paragraphs)?.from ?? null) : null;

  const markPageKnown = usePageKnown({ textId: text.id, statuses: vocab.statuses, markRemainingKnown, onSaved, onError: setError });
  const leavePage = useCallback(
    (n: number) => {
      if (settings.pageKnown && n === page + 1 && n <= paging.count) markPageKnown(paging.paragraphs);
    },
    [settings.pageKnown, page, paging.count, paging.paragraphs, markPageKnown],
  );
  const follow = useCallback(
    (i: number) => {
      const n = pageOfToken(pages, i);
      leavePage(n);
      return goTo(n, "replace");
    },
    [pages, leavePage, goTo],
  );
  const { reveal, turnPage } = usePageTurns({ page, goTo, goToToken, follow, articleRef, place, close, active });

  const changePage = useCallback(
    (n: number) => {
      leavePage(n);
      turnPage(n);
    },
    [leavePage, turnPage],
  );

  const onOpen = useCallback(() => {
    if (settings.pauseOnLookup) mediaRef.current?.pause();
  }, [settings.pauseOnLookup]);
  const revealPopup = useCallback((i: number) => reveal(i, "nearest", true), [reveal]);
  const { openWord, openPhrase, openWordOfPhrase, backToPhrase } = usePopupOpeners({ tokens, sentences, popup, reveal: revealPopup, autoSave, onError: setError, onOpen });

  const setStatus = useCallback(
    (status: WordStatus | null) => {
      if (target) void setVocabStatus(target, status);
    },
    [target, setVocabStatus],
  );
  const onLookup = useCallback(
    (lookup: WordLookup) => {
      if (target) recordLookup(target, lookup);
    },
    [target, recordLookup],
  );
  const onPickMeaning = useCallback(
    (meaning: string) => {
      if (target) void pickMeaning(target, meaning);
    },
    [target, pickMeaning],
  );
  const saveSentence = useCallback(
    async (translation?: string) => {
      if (!target) return;
      await api("vocabulary", { body: { language, term: target.sentence, kind: "phrase", definition: translation, textId: text.id } });
      void refresh();
    },
    [target, language, text.id, refresh],
  );

  const shown = onPage(target, pages, page);
  const input = useReaderInput({
    tokens, sel, setSel: popup.setSel, popup: shown && shown.kind, phraseMode: popup.phraseMode, openWord, openPhrase,
    savedPhraseAt: phraseAt, setStatus, close,
    articleRef, popupRef, turnPage: (dir) => changePage(page + dir),
  });
  const media = mediaState(!!video, audio, showAudio);
  useMediaShortcuts(media.shortcuts ? (action) => mediaRef.current?.shortcut(action) : null);

  const jumpToToken = useCallback(
    (i: number) => {
      setSpoken({ token: i, sentence: tokens[i]?.sentence ?? null });
      reveal(i, "center", false, "replace");
    },
    [reveal, tokens],
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
    <ListenContext.Provider value={session.listen}>
    <div {...layoutProps(settings, !!video, media.playerBar)}>
      <div className="reader-column min-w-0 lg:col-start-1">
        <ReaderHeader text={text} playlist={playlist} stats={stats} settings={settings} onSettings={updateSettings} audio={audioButton} media={media.shortcuts} />
      </div>
      <VideoPanel
        ref={mediaRef} video={video} tokens={tokens} onSpoken={setSpoken} onJumpToToken={jumpToToken} cueToken={cueToken} maxHeight={videoMax}
        layout={settings.video} onLayout={(layout) => updateSettings({ video: layout })}
      />

      <div className="reader-column min-w-0 lg:col-start-1">
        <ErrorNote message={error} />
        <PhraseHint show={popup.phraseMode} />
        <div ref={articleRef} className="relative">
          <article
            data-tour="reader-text"
            className={articleClass(language, settings.size, settings.quiet)}
            lang={language}
            onPointerDown={input.onPointerDown}
            onPointerOver={input.onPointerOver}
            onPointerLeave={input.onPointerLeave}
            onClick={input.onClick}
          >
            {paging.paragraphs.map((p, k) => (
              <Paragraph key={k} tokens={p} statuses={vocab.statuses} phrases={marks} gaps={gaps} edges={edges} hover={overlapping(p, input.hover, null).sel} sentence={followsSentence(settings.follow) ? sentenceHere(p, spoken.sentence) : null} {...overlapping(p, sel, active)} />
            ))}
          </article>
          <PageArrows page={page} count={paging.count} onPage={changePage} />
          <FollowMarker enabled={showsMarker(followsWord(settings.follow), media.playerBar)} containerRef={articleRef} active={active} nextOf={nextOf} budgets={budgets} page={page} />

          {measuring && <TextMeasure ref={measureRef} paragraphs={paragraphs} className={articleClass(language, settings.size, false)} />}

          <ReaderPopup
              ref={popupRef}
              target={shown}
              anchor={popup.anchor}
              language={language}
              speechLocale={initial.speechLocale}
              status={vocab.statusOf(shown)}
              statuses={vocab.statuses}
              onOpenWord={openWordOfPhrase}
              onBack={backToPhrase}
              isPro={isPro}
              notice={popup.notice}
              hasAudio={media.synced}
              onStatus={setStatus}
              onLookup={onLookup}
              onPickMeaning={onPickMeaning}
              onSaveSentence={saveSentence}
              onPlayFromHere={playFromHere}
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
          onSpoken={setSpoken}
          onJumpToToken={jumpToToken}
          onAudioChanged={setAudio}
          cueToken={cueToken}
          onClose={() => {
            setShowAudio(false);
            setSpoken(NOTHING_SPOKEN);
          }}
        />
      )}
    </div>
    </ListenContext.Provider>
  );
}
