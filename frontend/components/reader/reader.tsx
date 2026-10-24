"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReaderPlaylist } from "@/lib/playlist-types";
import type { TextDetail, Token } from "@/lib/types";
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
import { pageOfToken, pageRange, sentencePages, unseenOnPage } from "./reader-pages";
import { PageArrows } from "./reader-pager";
import { articleClass, audioToggle, layoutProps, mediaState, onPage, pageNote, PhraseHint, showsMarker } from "./reader-parts";
import { ReaderPopup } from "./reader-popup";
import { followsSentence, followsWord, type ReaderSettings } from "./reader-settings";
import { learningEdges, learningGaps, nextWord, overlapping, phraseMarks, phraseSpans, readerStats, savedPhraseAt, sentenceHere, sentenceTexts, toParagraphs } from "./reader-text";
import { transcriptParagraphs } from "./reader-transcript";
import { SentenceExtras, SentenceTranslation } from "./sentence-tools";
import { ArticleBody, ReaderNav, sentenceMode, sentenceOf } from "./sentence-view";
import { TextMeasure } from "./text-measure";
import { NOTHING_SPOKEN, type MediaHandle } from "./use-media-player";
import { usePageKnown } from "./use-page-known";
import { useFitPages, useMeasuring } from "./use-fit-pages";
import { useLessonActions } from "./use-lesson-actions";
import { usePageTurns } from "./use-page-turns";
import { useMediaShortcuts, useReaderInput } from "./use-reader-input";
import { useReaderPages } from "./use-reader-pages";
import { useKeepPopupPlaced, usePopupOpeners, usePopupState } from "./use-reader-popup";
import { useReaderSettings } from "./use-reader-settings";
import { ListenContext, useReadingSession } from "./use-reading-session";
import { useVocabularyStatus } from "./use-vocabulary-status";
import { useWordFocus } from "./use-word-focus";
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
  const { settings, update: updateSettings } = useReaderSettings(initialSettings);

  const articleRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaHandle>(null);
  const session = useReadingSession(text.id);
  const onSaved = useCallback(() => void refresh(), [refresh]);
  const popup = usePopupState(articleRef, popupRef);
  const { sel, target, place, close } = popup;
  const vocab = useVocabularyStatus({
    language,
    textId: text.id,
    initialStatuses: initial.statuses,
    initialPhrases: initial.phrases,
    names: initial.names,
    onSaved,
    onKnownWord: flyFromWord,
    onNotice: popup.setNotice,
    onError: setError,
  });
  const { autoSave, markRemainingKnown } = vocab;
  const actions = useLessonActions({ target, textId: text.id, language, tokens, vocab, completeSession: session.complete, refresh, setError });
  const [translations] = useState(() => new Map<string, string>());

  const sentences = useMemo(() => sentenceTexts(tokens), [tokens]);
  const paragraphs = useMemo(() => (video ? transcriptParagraphs(tokens) : toParagraphs(tokens)), [tokens, video]);
  const measuring = useMeasuring();
  const { pages: fitted, videoMax, height } = useFitPages(paragraphs, measureRef, articleRef, measuring, `${settings.video}:${settings.tucked}:${settings.view}`);
  const bySentence = useMemo(() => sentencePages(paragraphs), [paragraphs]);
  const mode = sentenceMode(settings, bySentence, fitted);
  const paging = useReaderPages(text.id, tokens, paragraphs, mode.pages, text.progress?.position ?? null);
  const { page, pages, goTo, goToToken } = paging;
  const { reach } = mode;
  const budgets = useMemo(() => slideBudgets(audio?.timings ?? video?.timings ?? []), [audio, video]);
  const nextOf = useCallback((i: number) => nextWord(tokens, i, 1), [tokens]);
  const spans = useMemo(() => phraseSpans(tokens, vocab.phrases), [tokens, vocab.phrases]);
  const marks = useMemo(() => phraseMarks(tokens, vocab.phrases), [tokens, vocab.phrases]);
  const gaps = useMemo(() => learningGaps(tokens, spans), [tokens, spans]);
  const edges = useMemo(() => learningEdges(spans), [spans]);
  const phraseAt = useCallback((i: number) => savedPhraseAt(spans, i), [spans]);
  const stats = useMemo(() => readerStats(tokens, vocab.shown), [tokens, vocab.shown]);
  const unseenHere = useMemo(() => unseenOnPage(paging.paragraphs, vocab.shown), [paging.paragraphs, vocab.shown]);

  const pageStart = pageRange(paging.paragraphs)?.from ?? null;
  const cueToken = page > 1 ? pageStart : null;
  const isShown = useCallback((i: number) => pageOfToken(pages, i) === page, [pages, page]);
  const goToNear = useCallback((i: number, mode?: "push" | "replace") => Math.abs(pageOfToken(pages, i) - page) > reach && goToToken(i, mode), [pages, page, reach, goToToken]);
  const startPage = useCallback((i: number | null) => mediaRef.current?.startPage(i), []);

  const markPageKnown = usePageKnown({ textId: text.id, statuses: vocab.shown, markRemainingKnown, onSaved, onError: setError });
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
  const { reveal, turnPage } = usePageTurns({ page, goTo, goToToken: goToNear, follow, articleRef, place, close, active, pageStart, onPage: isShown, startPage });

  const changePage = useCallback(
    (n: number) => {
      if (mode.on && n === page + 1 && mediaRef.current?.carryOn()) return;
      leavePage(n);
      turnPage(n);
    },
    [mode.on, page, leavePage, turnPage],
  );

  const onOpen = useCallback(() => {
    if (settings.pauseOnLookup) mediaRef.current?.pause();
  }, [settings.pauseOnLookup]);
  const revealPopup = useCallback((i: number) => reveal(i, "nearest", true), [reveal]);
  const { openWord, openPhrase, openWordOfPhrase, backToPhrase } = usePopupOpeners({ tokens, sentences, popup, reveal: revealPopup, autoSave, onError: setError, onOpen });

  const shown = onPage(target, pages, page, reach);
  useKeepPopupPlaced(popupRef, popup.position, shown);
  const input = useReaderInput({
    tokens, sel, setSel: popup.setSel, popup: shown && shown.kind, phraseMode: popup.phraseMode, openWord, openPhrase,
    savedPhraseAt: phraseAt, setStatus: actions.setStatus, close,
    articleRef, popupRef, turnPage: (dir) => changePage(page + dir),
  });
  const pageWords = useMemo(() => paging.paragraphs.flat().filter((t) => t.word).map((t) => t.index), [paging.paragraphs]);
  const focus = useWordFocus({ articleRef, tokens, pageWords, sel, popupOpen: !!shown, activate: input.activate });
  const media = mediaState(!!video, audio, showAudio);
  useMediaShortcuts(media.shortcuts ? (action) => mediaRef.current?.shortcut(action) : null);

  const jumpToToken = useCallback(
    (i: number) => {
      setSpoken({ token: i, sentence: tokens[i]?.sentence ?? null });
      reveal(i, "center", false, "replace");
    },
    [reveal, tokens],
  );

  function playFromHere() {
    if (!target) return;
    if (!video) setShowAudio(true);
    mediaRef.current?.playFromToken(target.startToken);
  }

  const isOwner = text.owner.id === me.id;
  const audioButton = audioToggle(audio, isOwner, !!video, showAudio, () => setShowAudio(!showAudio));
  const paragraph = (p: Token[], k: number) => (
    <Paragraph key={k} tokens={p} statuses={vocab.shown} phrases={marks} gaps={gaps} edges={edges} hover={overlapping(p, input.hover, null).sel} stop={p.some((t) => t.index === focus.stop) ? focus.stop : null} sentence={followsSentence(settings.follow) ? sentenceHere(p, spoken.sentence) : null} {...overlapping(p, sel, active)} />
  );
  const sentenceText = sentenceOf(sentences, paging.paragraphs);
  const { pauseEach } = mode;
  const note = pageNote(settings.pageKnown, page, paging.count, unseenHere, mode.unit);

  return (
    <ListenContext.Provider value={session.listen}>
    <div {...layoutProps(settings, !!video, media.playerBar)}>
      <div className="reader-column min-w-0 lg:col-start-1">
        <ReaderHeader text={text} playlist={playlist} stats={stats} settings={settings} onSettings={updateSettings} audio={audioButton} media={media.shortcuts} />
      </div>
      <VideoPanel
        ref={mediaRef} video={video} tokens={tokens} onSpoken={setSpoken} onJumpToToken={jumpToToken} cueToken={cueToken} pauseEach={pauseEach} maxHeight={videoMax}
        layout={settings.video} onLayout={(layout) => updateSettings({ video: layout })}
        tucked={settings.tucked} onTucked={(tucked) => updateSettings({ tucked })}
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
            onFocus={focus.onFocus}
            onKeyDown={focus.onKeyDown}
          >
            <ArticleBody on={mode.on} paragraphs={paging.paragraphs} pages={pages} page={page} height={height} paragraph={paragraph} onMove={(dir) => changePage(page + dir)}
              below={<SentenceTranslation key={page} text={sentenceText} language={language} isPro={isPro} cache={translations} />} />
          </article>
          <PageArrows page={page} count={paging.count} onPage={changePage} hidden={mode.on} />
          <FollowMarker enabled={showsMarker(followsWord(settings.follow), media.playerBar)} containerRef={articleRef} active={active} nextOf={nextOf} budgets={budgets} page={page} />

          {measuring && <TextMeasure ref={measureRef} paragraphs={paragraphs} unseen={stats.unseen} className={articleClass(language, settings.size, false)} />}

          <ReaderPopup
              ref={popupRef}
              target={shown}
              language={language}
              speechLocale={initial.speechLocale}
              status={vocab.statusOf(shown)}
              statuses={vocab.shown}
              onOpenWord={openWordOfPhrase}
              onBack={backToPhrase}
              isPro={isPro}
              notice={popup.notice}
              hasAudio={media.synced}
              onStatus={actions.setStatus}
              onLookup={actions.onLookup}
              onPickMeaning={actions.onPickMeaning}
              onSaveSentence={actions.saveSentence}
              onPlayFromHere={playFromHere}
              onPhraseMode={() => popup.setPhraseMode(true)}
              onClose={close}
            />
        </div>

        <ReaderNav on={mode.on} page={page} count={paging.count} onPage={changePage} note={note}>
          <SentenceExtras key={page} text={sentenceText} language={language} textId={text.id} onSaved={onSaved} media={media}
            pauseEach={settings.pauseEach} onPauseEach={(each) => updateSettings({ pauseEach: each })} />
        </ReaderNav>

        <FinishPanel
          visible={page >= paging.count} textId={text.id} language={language} isPro={isPro} unseen={stats.unseen}
          learning={stats.learning} finished={actions.finished} finishing={actions.finishing} onFinish={actions.finish} playlist={playlist}
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
          pauseEach={pauseEach}
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
