package app.lector.admin;

import app.lector.ai.AiJob;
import app.lector.text.NotWords;
import app.lector.text.TextWords;
import app.lector.text.WordVerdicts;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.vocab.NotWordsInVocabulary;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.stereotype.Service;

@Service
public class AdminNotWords {

    static final int MAX_CALLS = 40;

    public record Plan(Language language, int texts, int words, int calls, long estimatedTokens,
                       double estimatedCost) {}

    public record Report(Language language, int calls, long tokensIn, long tokensOut, double cost,
                         List<String> notWords, int wordsLeft, int textsUpdated, int wordsIgnored, String stopped) {}

    private record Scope(List<String> unjudged, int texts) {}

    private final TextWords textWords;
    private final NotWords notWords;
    private final WordVerdicts verdicts;
    private final NotWordsInVocabulary vocabulary;
    private final LookupPrices prices;
    private final AdminLog log;

    public AdminNotWords(TextWords textWords, NotWords notWords, WordVerdicts verdicts,
                         NotWordsInVocabulary vocabulary, LookupPrices prices, AdminLog log) {
        this.textWords = textWords;
        this.notWords = notWords;
        this.verdicts = verdicts;
        this.vocabulary = vocabulary;
        this.prices = prices;
        this.log = log;
    }

    private Scope scope(Language language) {
        TextWords.WordsInTexts inTexts = textWords.wordsInTexts(language);
        Set<String> all = new HashSet<>(vocabulary.knownTerms(language));
        inTexts.byText().values().forEach(all::addAll);
        Set<String> candidates = NotWords.candidates(language, all, inTexts.names());
        Set<String> unjudged = new TreeSet<>(candidates);
        unjudged.removeAll(verdicts.find(language, candidates).keySet());
        long texts = inTexts.byText().values().stream().filter(w -> !Collections.disjoint(w, unjudged)).count();
        return new Scope(List.copyOf(unjudged), (int) texts);
    }

    private static List<List<String>> batches(List<String> words) {
        List<List<String>> out = new ArrayList<>();
        for (int i = 0; i < words.size(); i += NotWords.BATCH) {
            out.add(words.subList(i, Math.min(words.size(), i + NotWords.BATCH)));
        }
        return out;
    }

    public Plan plan(Language language) {
        Scope scope = scope(language);
        long in = 0;
        long out = 0;
        List<List<String>> batches = batches(scope.unjudged());
        for (List<String> batch : batches) {
            in += NotWords.estimatedInput(language, batch);
            out += NotWords.outputCap(language, batch);
        }
        return new Plan(language, scope.texts(), scope.unjudged().size(), batches.size(), in + out,
                prices.cost(AiJob.NOT_WORDS, in, out));
    }

    public Report run(User admin, Language language, int maxCalls, long maxTokens) {
        Scope scope = scope(language);
        int limit = Math.max(0, Math.min(MAX_CALLS, maxCalls));
        Run run = new Run();
        for (List<String> batch : batches(scope.unjudged())) {
            run.stopped = stopBefore(language, batch, run, limit, maxTokens);
            if (run.stopped != null) {
                break;
            }
            Optional<NotWords.Judged> judged = notWords.judge(language, batch);
            if (judged.isEmpty()) {
                run.stopped = "failed";
                break;
            }
            run.add(judged.get());
        }
        Set<String> all = verdicts.notWords(language);
        int textsUpdated = textWords.refreshNotWords(language, all);
        int wordsIgnored = vocabulary.setAside(language, all);
        Report report = new Report(language, run.calls, run.tokensIn, run.tokensOut,
                prices.cost(AiJob.NOT_WORDS, run.tokensIn, run.tokensOut), run.found,
                scope.unjudged().size() - run.judged, textsUpdated, wordsIgnored,
                run.stopped == null ? "done" : run.stopped);
        log.record(admin, "not-words cleanup", language.displayName() + ": " + report.calls() + " calls, "
                + report.notWords().size() + " not-words found, " + textsUpdated + " texts updated, "
                + wordsIgnored + " known words ignored, " + report.stopped());
        return report;
    }

    private String stopBefore(Language language, List<String> batch, Run run, int limit, long maxTokens) {
        if (run.calls >= limit) {
            return "calls";
        }
        if (!notWords.aiEnabled()) {
            return "off";
        }
        if (!notWords.canCall()) {
            return "ceiling";
        }
        long projected = run.tokensIn + run.tokensOut + NotWords.estimatedInput(language, batch)
                + NotWords.outputCap(language, batch);
        return projected > maxTokens ? "cap" : null;
    }

    private static final class Run {
        int calls;
        int judged;
        long tokensIn;
        long tokensOut;
        String stopped;
        final List<String> found = new ArrayList<>();

        void add(NotWords.Judged judged) {
            calls++;
            this.judged += judged.verdicts().size();
            tokensIn += judged.tokensIn();
            tokensOut += judged.tokensOut();
            found.addAll(judged.notWords());
        }
    }
}
