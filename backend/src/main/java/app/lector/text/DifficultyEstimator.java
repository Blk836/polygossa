package app.lector.text;

import app.lector.token.Language;
import app.lector.token.Token;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class DifficultyEstimator {

    public static final List<String> LEVELS = List.of("A1", "A2", "B1", "B2", "C1", "C2");

    public record Estimate(String level, double score, int wordCount, int uniqueWordCount) {}

    private DifficultyEstimator() {}

    public static Estimate estimate(Language language, List<Token> tokens) {
        return estimate(language, tokens, Set.of());
    }

    public static Estimate estimate(Language language, List<Token> tokens, Set<String> names) {
        int all = 0;
        int words = 0;
        long chars = 0;
        Set<String> unique = new HashSet<>();
        Set<Integer> sentences = new HashSet<>();
        for (Token t : tokens) {
            if (!t.word()) {
                continue;
            }
            all++;
            if (names.contains(t.normalized())) {
                continue;
            }
            words++;
            chars += t.text().codePointCount(0, t.text().length());
            unique.add(t.normalized());
            sentences.add(t.sentence());
        }
        if (words == 0) {
            return new Estimate("A1", 0, all, 0);
        }
        double guiraud = unique.size() / Math.sqrt(words);
        double avgWordLength = (double) chars / words;
        double avgSentenceLength = (double) words / Math.max(1, sentences.size());

        double diversity = scale(guiraud, 3.5, 10.0);
        double wordLength = language.spaceDelimited() && language != Language.KO
                ? scale(avgWordLength, 4.0, 6.5)
                : scale(avgWordLength, 1.2, 2.2);
        double sentenceLength = scale(avgSentenceLength, 6, 28);

        double diversityWeight = words < 60 ? 0.2 : 0.45;
        double score = diversityWeight * diversity
                + (1 - diversityWeight) * 0.55 * wordLength
                + (1 - diversityWeight) * 0.45 * sentenceLength;
        int index = Math.min(LEVELS.size() - 1, (int) Math.floor(score * LEVELS.size()));
        return new Estimate(LEVELS.get(index), score, all, unique.size());
    }

    private static double scale(double value, double low, double high) {
        return Math.max(0, Math.min(1, (value - low) / (high - low)));
    }
}
