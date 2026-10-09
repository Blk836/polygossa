package app.lector.text;

import app.lector.progress.ReadingProgress;
import app.lector.progress.ReadingProgressRepository;
import app.lector.token.ElisionJoiner;
import app.lector.token.Language;
import app.lector.token.Token;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Brings French and Italian texts tokenized while elisions were split ("l'" + "homme") up to date: the halves become
 * one word and the word counts and level are recalculated. Token indexes shift, so the audio/video timings and
 * everyone's reading position move with them. Runs on every startup; texts that are already right are left untouched.
 */
@Component
public class ElisionBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ElisionBackfill.class);

    private final TextRepository repository;
    private final ReadingProgressRepository progress;
    private final TextService texts;
    private final ObjectMapper json;

    public ElisionBackfill(TextRepository repository, ReadingProgressRepository progress, TextService texts,
                           ObjectMapper json) {
        this.repository = repository;
        this.progress = progress;
        this.texts = texts;
        this.json = json;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int fixed = 0;
        for (Text text : repository.findWithSplitElisions(List.of(Language.FR, Language.IT))) {
            ElisionJoiner.Joined joined = ElisionJoiner.join(text.getLanguage(), texts.tokens(text));
            if (!joined.changed()) {
                continue;
            }
            List<Token> tokens = joined.tokens();
            DifficultyEstimator.Estimate estimate = DifficultyEstimator.estimate(text.getLanguage(), tokens);
            text.setTokensJson(json.writeValueAsString(tokens));
            text.setWordsJson(KnownWords.wordsJson(tokens, json));
            text.setCefrLevel(estimate.level());
            text.setWordCount(estimate.wordCount());
            text.setUniqueWordCount(estimate.uniqueWordCount());
            if (text.getTimingsJson() != null) {
                text.setTimingsJson(json.writeValueAsString(timings(text, joined.newIndex())));
            }
            for (ReadingProgress p : progress.findForText(text.getId())) {
                p.setPosition(position(p.getPosition(), joined));
            }
            fixed++;
        }
        if (fixed > 0) {
            log.info("Joined split elisions in the words of {} text(s)", fixed);
        }
    }

    /** One timing per joined word, spanning the timings of its halves. */
    private List<AudioAligner.WordTiming> timings(Text text, int[] newIndex) {
        List<AudioAligner.WordTiming> old = json.readValue(text.getTimingsJson(),
                new TypeReference<List<AudioAligner.WordTiming>>() {});
        List<AudioAligner.WordTiming> out = new ArrayList<>(old.size());
        for (AudioAligner.WordTiming t : old) {
            int i = t.i() >= 0 && t.i() < newIndex.length ? newIndex[t.i()] : t.i();
            AudioAligner.WordTiming last = out.isEmpty() ? null : out.getLast();
            if (last != null && last.i() == i) {
                out.set(out.size() - 1, new AudioAligner.WordTiming(i, Math.min(last.s(), t.s()),
                        Math.max(last.e(), t.e())));
            } else {
                out.add(new AudioAligner.WordTiming(i, t.s(), t.e()));
            }
        }
        return out;
    }

    /** The same place in the joined tokens; a position past the last token stays past it. */
    private static int position(int old, ElisionJoiner.Joined joined) {
        int[] newIndex = joined.newIndex();
        if (old < 0) {
            return old;
        }
        return old < newIndex.length ? newIndex[old] : old - (newIndex.length - joined.tokens().size());
    }
}
