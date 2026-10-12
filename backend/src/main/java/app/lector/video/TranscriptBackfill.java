package app.lector.video;

import app.lector.progress.ReadingProgress;
import app.lector.progress.ReadingProgressRepository;
import app.lector.text.SubtitleParser;
import app.lector.text.SubtitleParser.Cue;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.token.Token;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Component
public class TranscriptBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(TranscriptBackfill.class);

    private record Snapshot(Language language, String content, List<Cue> cues) {}

    private final TextRepository repository;
    private final ReadingProgressRepository progress;
    private final TextService texts;
    private final TranscriptTidy tidy;
    private final ObjectMapper json;
    private final TransactionTemplate tx;

    public TranscriptBackfill(TextRepository repository, ReadingProgressRepository progress, TextService texts,
                              TranscriptTidy tidy, ObjectMapper json, PlatformTransactionManager transactions) {
        this.repository = repository;
        this.progress = progress;
        this.texts = texts;
        this.tidy = tidy;
        this.json = json;
        this.tx = new TransactionTemplate(transactions);
    }

    @Override
    public void run(ApplicationArguments args) {
        if (tidy.enabled()) {
            Thread.ofVirtual().name("transcript-backfill").start(this::backfill);
        }
    }

    public int backfill() {
        if (!tidy.enabled()) {
            return 0;
        }
        int tidied = 0;
        for (Long id : repository.findIdsWithUncheckedTranscripts()) {
            try {
                if (tidyOne(id)) {
                    tidied++;
                }
            } catch (RuntimeException e) {
                log.warn("Could not tidy the transcript of text {}: {}", id, e.getMessage());
            }
        }
        if (tidied > 0) {
            log.info("Tidied the transcripts of {} video(s)", tidied);
        }
        return tidied;
    }

    private boolean tidyOne(Long id) {
        Snapshot before = tx.execute(status -> repository.findById(id)
                .map(t -> new Snapshot(t.getLanguage(), t.getContent(), texts.cues(t)))
                .orElse(null));
        if (before == null) {
            return false;
        }
        boolean intact = !before.cues().isEmpty()
                && SubtitleParser.join(before.cues()).content().equals(before.content());
        SubtitleParser.Parsed tidied = intact ? tidy.tidy(before.language(), true, before.cues()) : null;
        return Boolean.TRUE.equals(tx.execute(status -> save(id, before.content(), tidied)));
    }

    private boolean save(Long id, String before, SubtitleParser.Parsed tidied) {
        Text text = repository.findById(id).orElse(null);
        if (text == null) {
            return false;
        }
        text.setTranscriptChecked(true);
        if (tidied == null || tidied.content().equals(before) || !text.getContent().equals(before)) {
            return false;
        }
        List<Token> old = texts.tokens(text);
        List<Token> tokens = texts.replaceTranscript(text, tidied.content(), tidied.cues());
        text.setTimingsJson(json.writeValueAsString(
                VideoImportService.timings(tokens, tidied.cues(), text.getVideoDurationSeconds())));
        for (ReadingProgress p : progress.findForText(id)) {
            p.setPosition(position(p.getPosition(), old, tokens));
        }
        return true;
    }

    static int position(int old, List<Token> before, List<Token> after) {
        if (old <= 0) {
            return old;
        }
        int wordsBefore = (int) before.stream().limit(old).filter(Token::word).count();
        List<Integer> words = new ArrayList<>();
        after.forEach(t -> {
            if (t.word()) {
                words.add(t.index());
            }
        });
        if (wordsBefore < words.size()) {
            return words.get(wordsBefore);
        }
        return old >= before.size() ? after.size() : Math.max(0, after.size() - 1);
    }
}
