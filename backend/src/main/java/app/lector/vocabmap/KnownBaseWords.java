package app.lector.vocabmap;

import app.lector.token.Language;
import app.lector.vocab.KnownForm;
import app.lector.vocab.VocabularyRepository;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class KnownBaseWords {

    private final VocabularyRepository vocabulary;
    private final Map<Language, Map<String, String>> headwords = new EnumMap<>(Language.class);

    public KnownBaseWords(VocabularyRepository vocabulary, VocabMapCatalog catalog) {
        this.vocabulary = vocabulary;
        for (Language language : Language.values()) {
            catalog.list(language).ifPresent(list -> {
                Map<String, String> owners = new HashMap<>();
                list.words().forEach(w -> w.forms().forEach(form -> owners.put(form, w.headword())));
                headwords.put(language, owners);
            });
        }
    }

    public Map<Language, Long> byLanguage(Long userId) {
        Map<Language, Set<String>> bases = new EnumMap<>(Language.class);
        for (KnownForm form : vocabulary.findKnownForms(userId, null)) {
            bases.computeIfAbsent(form.language(), l -> new HashSet<>()).add(base(form));
        }
        Map<Language, Long> counts = new EnumMap<>(Language.class);
        bases.forEach((language, words) -> counts.put(language, (long) words.size()));
        return counts;
    }

    public long count(Long userId, Language language) {
        if (language == null) {
            return byLanguage(userId).values().stream().mapToLong(Long::longValue).sum();
        }
        Set<String> bases = new HashSet<>();
        for (KnownForm form : vocabulary.findKnownForms(userId, language)) {
            bases.add(base(form));
        }
        return bases.size();
    }

    private String base(KnownForm form) {
        if (form.lemma() != null) {
            return form.lemma();
        }
        return headwords.getOrDefault(form.language(), Map.of()).getOrDefault(form.term(), form.term());
    }
}
