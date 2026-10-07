package app.lector.dictionary;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Translations into the learner's native language. The free dictionaries are English Wiktionary, whose translation
 * tables hang off English entries, so a German word for a Spanish speaker goes through its English gloss: "Hund" is
 * glossed "dog", and the senses of "dog" whose German translation is "Hund" give the Spanish "perro". A sense that
 * doesn't lead back to the word (dog → jagen) is someone else's meaning and is skipped. English words use their own
 * entry's tables directly.
 */
@Component
public class NativeGlosses {

    static final int MAX_TRANSLATIONS = 5;
    private static final int MAX_PIVOTS = 3;
    private static final int MAX_PIVOT_WORDS = 3;
    private static final Pattern PIVOT = Pattern.compile("[A-Za-z][A-Za-z' -]*");
    private static final Pattern LEADING_ARTICLE = Pattern.compile("^(?:to|a|an|the) ", Pattern.CASE_INSENSITIVE);

    private final DictionaryClient dictionary;

    public NativeGlosses(DictionaryClient dictionary) {
        this.dictionary = dictionary;
    }

    /** The result with translations into {@code nativeLanguage}, or unchanged when none are wanted. */
    public DictionaryResult add(DictionaryResult result, Language language, NativeLanguage nativeLanguage) {
        if (!result.found() || nativeLanguage == NativeLanguage.EN || nativeLanguage.code().equals(language.code())) {
            return result;
        }
        Set<String> found = new LinkedHashSet<>();
        if (language == Language.EN) {
            collect(result.term(), null, nativeLanguage, found);
        } else {
            Set<String> wanted = new LinkedHashSet<>();
            wanted.add(result.term().toLowerCase(Locale.ROOT));
            if (result.lemma() != null) {
                wanted.add(result.lemma().toLowerCase(Locale.ROOT));
            }
            List<String> definitions = result.senses().stream().map(DictionaryResult.Sense::definition).toList();
            for (String pivot : pivots(definitions)) {
                collect(pivot, new Back(language.code(), wanted), nativeLanguage, found);
            }
        }
        return result.withTranslations(nativeLanguage.code(), found.stream().limit(MAX_TRANSLATIONS).toList());
    }

    /** The target-language words a sense must translate back to, to count. */
    private record Back(String language, Set<String> words) {
        boolean leadsBack(List<DictionaryClient.Translation> table) {
            return table.stream().anyMatch(t -> t.language().equals(language)
                    && words.contains(t.word().toLowerCase(Locale.ROOT)));
        }
    }

    private void collect(String english, Back back, NativeLanguage nativeLanguage, Set<String> found) {
        for (List<DictionaryClient.Translation> table : dictionary.translationTables(english)) {
            if (back != null && !back.leadsBack(table)) {
                continue;
            }
            for (DictionaryClient.Translation t : table) {
                if (t.language().equals(nativeLanguage.code()) && nativeLanguage.writes(t.word())) {
                    found.add(t.word());
                }
            }
        }
    }

    /**
     * Short English glosses to look up: the head of each definition ("dog (animal)" → dog, "to hunt; to chase" →
     * hunt), at most three words, skipping "plural of …" style form-of definitions.
     */
    static List<String> pivots(List<String> definitions) {
        Set<String> out = new LinkedHashSet<>();
        for (String definition : definitions) {
            String head = LEADING_ARTICLE.matcher(definition.split("[;,(:.]", 2)[0].strip()).replaceFirst("").strip();
            boolean usable = PIVOT.matcher(head).matches() && head.split(" ").length <= MAX_PIVOT_WORDS
                    && DictionaryClient.lemmaFrom(definition, "") == null;
            if (usable) {
                out.add(head.toLowerCase(Locale.ROOT));
            }
        }
        return new ArrayList<>(out).subList(0, Math.min(out.size(), MAX_PIVOTS));
    }
}
