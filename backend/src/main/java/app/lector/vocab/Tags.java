package app.lector.vocab;

import app.lector.common.ApiException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** A learner's tags on their words: one word each (letters, digits, - and _), lower-case, at most ten per entry. */
public final class Tags {

    static final int MAX_TAGS = 10;
    static final int MAX_LENGTH = 30;
    private static final Pattern TAG = Pattern.compile("[\\p{L}\\p{N}_-]+");

    private Tags() {}

    /** Trimmed, lower-cased and de-duplicated (first spelling kept), or a 400 naming the problem. */
    public static List<String> normalize(List<String> raw) {
        Set<String> out = new LinkedHashSet<>();
        for (String tag : raw) {
            String t = tag == null ? "" : tag.strip().toLowerCase(Locale.ROOT);
            if (t.isEmpty() || t.length() > MAX_LENGTH || !TAG.matcher(t).matches()) {
                throw ApiException.badRequest("A tag is one word of 1-" + MAX_LENGTH
                        + " letters, digits, hyphens or underscores: \"" + tag + "\"");
            }
            out.add(t);
        }
        if (out.size() > MAX_TAGS) {
            throw ApiException.badRequest("At most " + MAX_TAGS + " tags per word");
        }
        return List.copyOf(out);
    }

    public record TagCount(String tag, int count) {}

    /** How many entries carry each tag, most used first (ties alphabetical), from the stored tag columns. */
    static List<TagCount> count(List<String> columns) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String column : columns) {
            for (String tag : column.strip().split(" ")) {
                counts.merge(tag, 1, Integer::sum);
            }
        }
        List<TagCount> out = new ArrayList<>();
        counts.forEach((tag, n) -> out.add(new TagCount(tag, n)));
        out.sort((a, b) -> a.count() != b.count() ? b.count() - a.count() : a.tag().compareTo(b.tag()));
        return out;
    }
}
