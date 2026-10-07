package app.lector.progress;

import app.lector.text.Text;
import app.lector.text.TextDtos.ProgressDto;
import app.lector.text.TextDtos.TextDetail;
import app.lector.text.TextDtos.TextSummary;
import app.lector.text.TextService;
import app.lector.token.Token;
import app.lector.user.User;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Saves how far each user has read each text, and adds it to the summaries Library and Explore show. */
@Service
public class ProgressService {

    /** The most words one step can credit: a page holds at most ~250, so more means pages were skipped. */
    static final int MAX_WORDS_PER_STEP = 500;

    private final ReadingProgressRepository repo;
    private final WordsReadRepository wordsRead;
    private final TextService texts;
    private final Clock clock;

    public ProgressService(ReadingProgressRepository repo, WordsReadRepository wordsRead, TextService texts,
                           Clock clock) {
        this.repo = repo;
        this.wordsRead = wordsRead;
        this.texts = texts;
        this.clock = clock;
    }

    /** The reader showed the page starting at token {@code position} (cut to the text). */
    @Transactional
    public ProgressDto record(User user, Long textId, int position) {
        Text text = texts.loadReadable(user, textId);
        List<Token> tokens = texts.tokens(text);
        int pos = Math.min(position, Math.max(0, tokens.size() - 1));
        ReadingProgress p = loadOrNew(user, text);
        credit(user, text, wordsBetween(tokens, p.getPosition(), pos));
        p.setPosition(pos);
        p.setPercent(Math.max(p.getPercent(), percentBefore(tokens, pos)));
        return save(p);
    }

    /** "Finish lesson": the text counts as fully read from now on, even if an earlier page is opened again. */
    @Transactional
    public void complete(User user, Long textId) {
        Text text = texts.loadReadable(user, textId);
        ReadingProgress p = loadOrNew(user, text);
        if (!p.isCompleted()) { // the last page: words from where the reader is to the end
            credit(user, text, wordsBetween(texts.tokens(text), p.getPosition(), Integer.MAX_VALUE));
        }
        p.setCompleted(true);
        p.setPercent(100);
        save(p);
    }

    @Transactional(readOnly = true)
    public List<TextSummary> attach(User user, List<TextSummary> summaries) {
        if (summaries.isEmpty()) {
            return summaries;
        }
        List<Long> ids = summaries.stream().map(TextSummary::id).toList();
        Map<Long, ProgressDto> byText = repo.findForTexts(user.getId(), ids).stream()
                .collect(Collectors.toMap(ReadingProgress::getTextId, ProgressService::dto));
        return summaries.stream().map(s -> s.withProgress(byText.get(s.id()))).toList();
    }

    /** Which of these texts the user has finished. */
    @Transactional(readOnly = true)
    public Set<Long> completedTextIds(User user, Collection<Long> textIds) {
        if (textIds.isEmpty()) {
            return Set.of();
        }
        return repo.findForTexts(user.getId(), textIds).stream().filter(ReadingProgress::isCompleted)
                .map(ReadingProgress::getTextId).collect(Collectors.toSet());
    }

    @Transactional(readOnly = true)
    public TextDetail attach(User user, TextDetail d) {
        ProgressDto p = repo.findOne(user.getId(), d.text().id()).map(ProgressService::dto).orElse(null);
        return new TextDetail(d.text().withProgress(p), d.tokens(), d.statuses(), d.phrases(), d.audio(), d.video(),
                d.speechLocale());
    }

    /** Whole percent (rounded down) of the text's words that come before token {@code position}. */
    static int percentBefore(List<Token> tokens, int position) {
        int words = 0;
        int before = 0;
        for (Token t : tokens) {
            if (t.word()) {
                words++;
                if (t.index() < position) {
                    before++;
                }
            }
        }
        return words == 0 ? 0 : before * 100 / words;
    }

    /** Words with token index in [from, to); none when going back. */
    static int wordsBetween(List<Token> tokens, int from, int to) {
        int words = 0;
        for (Token t : tokens) {
            if (t.word() && t.index() >= from && t.index() < to) {
                words++;
            }
        }
        return words;
    }

    /** Adds words read today (in the learner's time zone), at most {@link #MAX_WORDS_PER_STEP} per step. */
    private void credit(User user, Text text, int words) {
        if (words <= 0) {
            return;
        }
        LocalDate day = LocalDate.ofInstant(clock.instant(), user.zone());
        WordsRead row = wordsRead.findByUserIdAndLanguageAndDay(user.getId(), text.getLanguage(), day)
                .orElseGet(() -> wordsRead.save(new WordsRead(user.getId(), text.getLanguage(), day)));
        row.add(Math.min(words, MAX_WORDS_PER_STEP));
    }

    private ReadingProgress loadOrNew(User user, Text text) {
        return repo.findOne(user.getId(), text.getId()).orElseGet(() -> new ReadingProgress(user, text));
    }

    private ProgressDto save(ReadingProgress p) {
        p.setUpdatedAt(clock.instant());
        return dto(repo.save(p));
    }

    private static ProgressDto dto(ReadingProgress p) {
        return new ProgressDto(p.getPosition(), p.getPercent(), p.isCompleted());
    }
}
