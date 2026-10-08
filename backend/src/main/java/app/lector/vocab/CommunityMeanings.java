package app.lector.vocab;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Community meanings (word-translations.feature): what learners with one native language saved as a word's meaning.
 * Only meanings at least two learners share are shown, so one learner's typo or private wording never reaches others,
 * and only the meaning field counts (never notes).
 */
@Component
public class CommunityMeanings {

    static final int MIN_LEARNERS = 2;
    static final int MAX_MEANINGS = 3;

    private final VocabularyRepository repo;

    public CommunityMeanings(VocabularyRepository repo) {
        this.repo = repo;
    }

    /** The most shared meanings of {@code term} (a normalized key) in {@code language}, for {@code nativeLanguage}. */
    @Transactional(readOnly = true)
    public List<String> top(Language language, String term, NativeLanguage nativeLanguage) {
        return repo.findCommunityMeanings(language, term, nativeLanguage, MIN_LEARNERS, PageRequest.of(0, MAX_MEANINGS));
    }
}
