package app.lector.level;

import app.lector.text.DifficultyEstimator;
import app.lector.token.Language;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

public final class SkillLevels {

    public enum Confidence {
        LOW, MEDIUM, HIGH;

        @JsonValue
        public String code() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Skill(String level, Confidence confidence, int evidence) {

        static Skill none(int evidence) {
            return new Skill(null, null, evidence);
        }
    }

    public record Overall(String level, List<String> basedOn) {}

    static final List<String> LEVELS = DifficultyEstimator.LEVELS;
    private static final int[] WORDS = {50, 1200, 2500, 5000, 9000, 15000};
    private static final int[] CJK_WORDS = {50, 400, 1000, 2000, 4000, 7000};
    private static final int ITEMS_FOR_LEVEL = 3;
    private static final int WRITING_TESTS = 5;
    private static final int HIGH_CONFIDENCE_WORDS = 2500;

    private SkillLevels() {}

    static int vocabularyIndex(Language language, long known) {
        int[] thresholds = language == Language.JA || language == Language.ZH ? CJK_WORDS : WORDS;
        int index = -1;
        for (int i = 0; i < thresholds.length && known >= thresholds[i]; i++) {
            index = i;
        }
        return index;
    }

    public static Skill reading(Language language, long known, Map<String, Integer> finished) {
        int items = total(finished);
        int vocab = vocabularyIndex(language, known);
        if (vocab < 0) {
            return Skill.none(items);
        }
        int index = comfortIndex(finished, ITEMS_FOR_LEVEL) > vocab ? vocab + 1 : vocab;
        Confidence confidence = known >= HIGH_CONFIDENCE_WORDS ? Confidence.HIGH : byItems(items);
        return new Skill(LEVELS.get(index), confidence, items);
    }

    public static Skill listening(Language language, long known, Map<String, Integer> finished) {
        int items = total(finished);
        if (items == 0) {
            return Skill.none(0);
        }
        int cap = vocabularyIndex(language, known) + 1;
        int index = Math.min(cap, comfortIndex(finished, Math.min(ITEMS_FOR_LEVEL, items)));
        return new Skill(LEVELS.get(index), byItems(items), items);
    }

    public static Skill writing(List<String> levelsNewestFirst) {
        List<Integer> recent = levelsNewestFirst.stream().filter(Objects::nonNull).map(LEVELS::indexOf)
                .filter(i -> i >= 0).limit(WRITING_TESTS).toList();
        if (recent.isEmpty()) {
            return Skill.none(0);
        }
        int[] weight = new int[LEVELS.size()];
        int total = 0;
        for (int i = 0; i < recent.size(); i++) {
            int w = WRITING_TESTS - i;
            weight[recent.get(i)] += w;
            total += w;
        }
        int index = 0;
        int cumulative = weight[0];
        while (cumulative * 2 < total) {
            index++;
            cumulative += weight[index];
        }
        return new Skill(LEVELS.get(index), byTests(recent.size()), recent.size());
    }

    public static Overall overall(Skill reading, Skill listening, Skill writing) {
        List<String> basedOn = new ArrayList<>();
        int sum = 0;
        Skill[] skills = {reading, listening, writing};
        String[] names = {"reading", "listening", "writing"};
        for (int i = 0; i < skills.length; i++) {
            if (skills[i].level() != null) {
                basedOn.add(names[i]);
                sum += LEVELS.indexOf(skills[i].level());
            }
        }
        return basedOn.isEmpty() ? null : new Overall(LEVELS.get(sum / basedOn.size()), basedOn);
    }

    static int comfortIndex(Map<String, Integer> finished, int needed) {
        int atOrAbove = 0;
        for (int i = LEVELS.size() - 1; i >= 0; i--) {
            atOrAbove += finished.getOrDefault(LEVELS.get(i), 0);
            if (atOrAbove >= needed) {
                return i;
            }
        }
        return -1;
    }

    private static int total(Map<String, Integer> finished) {
        return finished.values().stream().mapToInt(Integer::intValue).sum();
    }

    private static Confidence byItems(int items) {
        return items < 3 ? Confidence.LOW : items < 10 ? Confidence.MEDIUM : Confidence.HIGH;
    }

    private static Confidence byTests(int tests) {
        return tests < 3 ? Confidence.LOW : tests < WRITING_TESTS ? Confidence.MEDIUM : Confidence.HIGH;
    }
}
