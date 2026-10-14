package app.lector.vocab;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class CommunityMeanings {

    public static final int MIN_LEARNERS = 2;
    static final int MAX_MEANINGS = 3;

    private final VocabularyRepository repo;

    public CommunityMeanings(VocabularyRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<String> top(Language language, String term, NativeLanguage nativeLanguage) {
        return repo.findCommunityMeanings(language, term, nativeLanguage, MIN_LEARNERS, PageRequest.of(0, MAX_MEANINGS));
    }

    @Transactional(readOnly = true)
    public Optional<String> mine(Long userId, Language language, String term, NativeLanguage nativeLanguage) {
        return repo.findByUserIdAndLanguageAndTerm(userId, language, term)
                .filter(e -> e.getMeaning() != null && e.getMeaningLanguage() == nativeLanguage)
                .map(VocabularyEntry::getMeaning);
    }
}
