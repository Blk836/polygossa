package app.lector.text;

import app.lector.token.Annotations;
import app.lector.token.Token;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Brings texts imported before caption annotations ("[musique]") were recognised up to date: their bracketed words
 * become non-words and the word counts and level are recalculated. The stored tokens are rewritten in place rather
 * than tokenized again, so token indexes (and the audio/video timings keyed by them) stay the same. Runs on every
 * startup; texts that are already right are left untouched.
 */
@Component
public class AnnotationBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AnnotationBackfill.class);

    private final TextRepository repository;
    private final TextService texts;
    private final ObjectMapper json;

    public AnnotationBackfill(TextRepository repository, TextService texts, ObjectMapper json) {
        this.repository = repository;
        this.texts = texts;
        this.json = json;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int fixed = 0;
        for (Text text : repository.findWithSquareBrackets()) {
            List<Token> tokens = texts.tokens(text);
            List<Token> unmarked = Annotations.unmark(tokens);
            if (unmarked.equals(tokens)) {
                continue;
            }
            DifficultyEstimator.Estimate estimate = DifficultyEstimator.estimate(text.getLanguage(), unmarked);
            text.setTokensJson(json.writeValueAsString(unmarked));
            text.setCefrLevel(estimate.level());
            text.setWordCount(estimate.wordCount());
            text.setUniqueWordCount(estimate.uniqueWordCount());
            fixed++;
        }
        if (fixed > 0) {
            log.info("Removed caption annotations from the words of {} text(s)", fixed);
        }
    }
}
