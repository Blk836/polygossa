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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProgressService {

    static final int MAX_WORDS_PER_STEP = 500;
    private static final Logger log = LoggerFactory.getLogger(ProgressService.class);

    private final ReadingProgressRepository repo;
    private final WordsReadRepository wordsRead;
    private final TextService texts;
    private final WordCounts wordCounts;
    private final PhraseCounts phraseCounts;
    private final Clock clock;

    public ProgressService(ReadingProgressRepository repo, WordsReadRepository wordsRead, TextService texts,
                           WordCounts wordCounts, PhraseCounts phraseCounts, Clock clock) {
        this.wordCounts = wordCounts;
        this.phraseCounts = phraseCounts;
        this.repo = repo;
        this.wordsRead = wordsRead;
        this.texts = texts;
        this.clock = clock;
    }

    @Transactional
    public ProgressDto record(User user, Long textId, int position) {
        Text text = texts.loadReadable(user, textId);
        fillCounts(user);
        List<Token> tokens = texts.tokens(text);
        int pos = Math.min(position, Math.max(0, tokens.size() - 1));
        ReadingProgress p = loadOrNew(user, text);
        credit(user, text, tokens, p.getPosition(), pos);
        p.setPosition(pos);
        p.setPercent(Math.max(p.getPercent(), percentBefore(tokens, pos)));
        return save(p);
    }

    @Transactional
    public void complete(User user, Long textId) {
        Text text = texts.loadReadable(user, textId);
        fillCounts(user);
        ReadingProgress p = loadOrNew(user, text);
        if (!p.isCompleted()) {
            credit(user, text, texts.tokens(text), p.getPosition(), Integer.MAX_VALUE);
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
                d.speechLocale(), d.names());
    }

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

    static int wordsBetween(List<Token> tokens, int from, int to) {
        int words = 0;
        for (Token t : tokens) {
            if (t.word() && t.index() >= from && t.index() < to) {
                words++;
            }
        }
        return words;
    }

    private void credit(User user, Text text, List<Token> tokens, int from, int to) {
        int words = wordsBetween(tokens, from, to);
        if (words <= 0) {
            return;
        }
        int end = WordCounts.cappedEnd(tokens, from, to, MAX_WORDS_PER_STEP);
        safely("word counts", () -> wordCounts.add(user.getId(), text.getLanguage(), tokens, from, end));
        safely("phrase counts", () -> phraseCounts.add(user.getId(), text.getLanguage(), tokens, from, end));
        LocalDate day = LocalDate.ofInstant(clock.instant(), user.zone());
        wordsRead.addWords(user.getId(), text.getLanguage().name(), day, Math.min(words, MAX_WORDS_PER_STEP));
    }

    private void fillCounts(User user) {
        safely("filling word counts", () -> wordCounts.fill(user.getId()));
        safely("filling phrase counts", () -> phraseCounts.fill(user.getId()));
    }

    private static void safely(String what, Runnable counting) {
        try {
            counting.run();
        } catch (RuntimeException e) {
            log.warn("Skipped {}: {}", what, e.toString());
        }
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
