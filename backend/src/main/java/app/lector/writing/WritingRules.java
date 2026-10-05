package app.lector.writing;

import app.lector.text.DifficultyEstimator;
import app.lector.token.Language;
import java.time.Duration;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** The fixed rules of a writing test: a set time, a minimum length by level, and how writing is counted. */
public final class WritingRules {

    public static final Duration TIME_LIMIT = Duration.ofMinutes(5);
    /** Accepts the browser's automatic hand-in at 0:00 despite network lag; nothing later. */
    public static final Duration GRACE = Duration.ofSeconds(30);

    private static final Map<String, Integer> MIN_WORDS = Map.of(
            "A1", 25, "A2", 40, "B1", 60, "B2", 80, "C1", 100, "C2", 120);
    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{M}\\p{N}]+");
    private static final Pattern CHARACTER = Pattern.compile("[\\p{L}\\p{N}]");

    private WritingRules() {}

    /** Japanese and Chinese are counted in characters (about two per word), everything else in words. */
    public static String unit(Language language) {
        return countsCharacters(language) ? "characters" : "words";
    }

    public static int minimum(String level, Language language) {
        if (level == null || !DifficultyEstimator.LEVELS.contains(level)) {
            throw new IllegalArgumentException("level must be one of " + DifficultyEstimator.LEVELS);
        }
        int words = MIN_WORDS.get(level);
        return countsCharacters(language) ? words * 2 : words;
    }

    public static int count(String text, Language language) {
        if (text == null) {
            return 0;
        }
        Matcher m = (countsCharacters(language) ? CHARACTER : WORD).matcher(text);
        int n = 0;
        while (m.find()) {
            n++;
        }
        return n;
    }

    /** Writing short of the minimum can score at most its share of it (30 of 60 words: 50 at most). */
    public static int capForLength(int score, int count, int minimum) {
        if (count >= minimum) {
            return score;
        }
        return Math.min(score, (int) Math.round(100.0 * count / minimum));
    }

    private static boolean countsCharacters(Language language) {
        return language == Language.JA || language == Language.ZH;
    }
}
