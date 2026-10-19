package app.lector.vocabmap;

import app.lector.token.Language;
import app.lector.vocab.KnownForm;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocabmap.VocabMapCatalog.MapWord;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class KnownBaseWords {

    private final VocabularyRepository vocabulary;
    private final VocabMapCatalog catalog;

    public KnownBaseWords(VocabularyRepository vocabulary, VocabMapCatalog catalog) {
        this.vocabulary = vocabulary;
        this.catalog = catalog;
    }

    public Map<Language, Long> byLanguage(Long userId) {
        Map<Language, List<KnownForm>> forms = new EnumMap<>(Language.class);
        for (KnownForm form : vocabulary.findKnownForms(userId, null)) {
            forms.computeIfAbsent(form.language(), l -> new ArrayList<>()).add(form);
        }
        Map<Language, Long> counts = new EnumMap<>(Language.class);
        forms.forEach((language, known) -> counts.put(language, count(language, known)));
        return counts;
    }

    public long count(Long userId, Language language) {
        if (language == null) {
            return byLanguage(userId).values().stream().mapToLong(Long::longValue).sum();
        }
        return count(language, vocabulary.findKnownForms(userId, language));
    }

    private long count(Language language, List<KnownForm> known) {
        Map<String, String> headwords = headwords(language, known);
        Set<String> bases = new HashSet<>();
        for (KnownForm form : known) {
            bases.add(form.lemma() != null ? form.lemma() : headwords.getOrDefault(form.term(), form.term()));
        }
        return bases.size();
    }

    private Map<String, String> headwords(Language language, List<KnownForm> known) {
        Set<String> unknownBase = new HashSet<>();
        for (KnownForm form : known) {
            if (form.lemma() == null) {
                unknownBase.add(form.term());
            }
        }
        Map<String, String> headwords = new HashMap<>();
        if (unknownBase.isEmpty()) {
            return headwords;
        }
        for (MapWord word : catalog.list(language).map(VocabMapCatalog.WordList::words).orElse(List.of())) {
            for (String form : word.forms()) {
                if (unknownBase.contains(form)) {
                    headwords.put(form, word.headword());
                }
            }
        }
        return headwords;
    }
}
