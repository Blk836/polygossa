package app.lector.dictionary;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.translation.InContext;
import app.lector.translation.MachineTranslations;
import app.lector.vocab.CommunityMeanings;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class OwnLanguageMeanings {

    private final CommunityMeanings community;
    private final MachineTranslations machine;

    public OwnLanguageMeanings(CommunityMeanings community, MachineTranslations machine) {
        this.community = community;
        this.machine = machine;
    }

    public WordLookup lookup(Long userId, Language language, NativeLanguage nativeLanguage, String key, String surface,
                             Optional<InContext> context) {
        if (nativeLanguage.code().equals(language.code())) {
            return new WordLookup(key, language.code(), List.of(), null, null);
        }
        WordLookup found = shared(language, nativeLanguage, key, surface, context);
        return community.mine(userId, language, key, nativeLanguage).map(mine -> leadingWith(found, mine)).orElse(found);
    }

    private WordLookup shared(Language language, NativeLanguage nativeLanguage, String key, String surface,
                              Optional<InContext> context) {
        List<String> shared = community.top(language, key, nativeLanguage);
        if (!shared.isEmpty()) {
            return new WordLookup(key, language.code(), shared, nativeLanguage.code(), WordLookup.COMMUNITY);
        }
        Optional<String> translated = machine.translate(language, nativeLanguage, key, surface, context);
        return translated
                .map(t -> new WordLookup(key, language.code(), List.of(t), nativeLanguage.code(), WordLookup.MACHINE))
                .orElseGet(() -> new WordLookup(key, language.code(), List.of(), nativeLanguage.code(), null));
    }

    private static WordLookup leadingWith(WordLookup found, String mine) {
        List<String> meanings = new ArrayList<>(List.of(mine));
        found.meanings().stream().filter(m -> !m.equalsIgnoreCase(mine)).forEach(meanings::add);
        return new WordLookup(found.term(), found.language(), meanings, found.meaningLanguage(), found.source());
    }
}
