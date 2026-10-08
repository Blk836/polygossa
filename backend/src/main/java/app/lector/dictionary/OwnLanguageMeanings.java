package app.lector.dictionary;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.translation.MachineTranslations;
import app.lector.vocab.CommunityMeanings;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * The word in the learner's own language (word-translations.feature), from the first of: meanings other learners
 * saved, Wiktionary's translation tables ({@link NativeGlosses}), and a stored or new machine translation. English
 * speakers, and learners reading their own language, get none.
 */
@Component
public class OwnLanguageMeanings {

    private final CommunityMeanings community;
    private final NativeGlosses glosses;
    private final MachineTranslations machine;

    public OwnLanguageMeanings(CommunityMeanings community, NativeGlosses glosses, MachineTranslations machine) {
        this.community = community;
        this.glosses = glosses;
        this.machine = machine;
    }

    /**
     * {@code result} (found or not) with the meanings of {@code key} (the word's normalized key) in
     * {@code nativeLanguage}; {@code surface} is the form looked up.
     */
    public DictionaryResult add(DictionaryResult result, Language language, NativeLanguage nativeLanguage, String key,
                                String surface) {
        if (nativeLanguage == NativeLanguage.EN || nativeLanguage.code().equals(language.code())) {
            return result;
        }
        List<String> shared = community.top(language, key, nativeLanguage);
        if (!shared.isEmpty()) {
            return result.withTranslations(nativeLanguage.code(), shared, DictionaryResult.COMMUNITY);
        }
        DictionaryResult glossed = glosses.add(result, language, nativeLanguage);
        if (glossed.translations() != null && !glossed.translations().isEmpty()) {
            return glossed;
        }
        String text = result.found() ? result.term() : surface;
        Optional<String> translated = machine.translate(language, nativeLanguage, key, text);
        if (translated.isPresent()) {
            return result.withTranslations(nativeLanguage.code(), List.of(translated.get()), DictionaryResult.MACHINE);
        }
        return glossed;
    }
}
