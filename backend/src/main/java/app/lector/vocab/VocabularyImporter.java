package app.lector.vocab;

import app.lector.token.Language;
import app.lector.token.TokenizationService;
import app.lector.user.PlanService;
import app.lector.user.User;
import app.lector.user.UserRepository;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabularyImporter {

    private static final int MAX_TERM = 500;

    private final VocabularyRepository repo;
    private final UserRepository users;
    private final PlanService plans;

    public VocabularyImporter(VocabularyRepository repo, UserRepository users, PlanService plans) {
        this.repo = repo;
        this.users = users;
        this.plans = plans;
    }

    @Transactional
    public ImportCounts importWords(Long userId, Language language, List<ImportedWord> words) {
        User user = users.findById(userId).orElseThrow();
        Set<String> keys = new LinkedHashSet<>();
        words.forEach(w -> keys.add(key(w, language)));
        Map<String, VocabularyEntry> entries = new HashMap<>();
        repo.findByUserIdAndLanguageAndTermIn(userId, language, keys).forEach(e -> entries.put(e.getTerm(), e));
        Batch batch = new Batch(user, language, plans.savedWordsLeft(user), entries);
        for (ImportedWord w : words) {
            String key = key(w, language);
            if (!key.isEmpty() && key.length() <= MAX_TERM) {
                batch.add(key, w);
            }
        }
        return batch.counts();
    }

    private static String key(ImportedWord w, Language language) {
        return w.term() == null ? "" : TokenizationService.normalize(w.term(), language);
    }

    private final class Batch {
        private final User user;
        private final Language language;
        private final Map<String, VocabularyEntry> entries;
        private long budget;
        private int added;
        private int updated;
        private int unchanged;
        private int overLimit;

        Batch(User user, Language language, long budget, Map<String, VocabularyEntry> entries) {
            this.user = user;
            this.language = language;
            this.budget = budget;
            this.entries = entries;
        }

        void add(String key, ImportedWord w) {
            VocabularyEntry existing = entries.get(key);
            if (existing != null) {
                if (merge(existing, w)) {
                    updated++;
                } else {
                    unchanged++;
                }
            } else if (w.status() == WordStatus.LEARNING && budget <= 0) {
                overLimit++;
            } else {
                entries.put(key, create(key, w));
                added++;
            }
        }

        private VocabularyEntry create(String key, ImportedWord w) {
            String display = w.term().strip();
            VocabularyEntry entry = new VocabularyEntry(user, language, key, display.substring(0, Math.min(display.length(),
                    MAX_TERM)), key.contains(" ") ? EntryKind.PHRASE : EntryKind.WORD);
            if (w.status() == WordStatus.LEARNING) {
                budget--;
            } else {
                apply(entry, w.status());
            }
            entry.setDefinition(w.definition());
            entry.setContextSentence(w.context());
            return repo.save(entry);
        }

        private boolean merge(VocabularyEntry e, ImportedWord w) {
            boolean changed = false;
            if (w.status() == WordStatus.KNOWN && e.getStatus() == WordStatus.LEARNING) {
                e.knownSince(user.getCreatedAt());
                changed = true;
            }
            if (e.getDefinition() == null && w.definition() != null) {
                e.setDefinition(w.definition());
                changed = true;
            }
            if (e.getContextSentence() == null && w.context() != null) {
                e.setContextSentence(w.context());
                changed = true;
            }
            return changed;
        }

        private void apply(VocabularyEntry entry, WordStatus status) {
            if (status == WordStatus.KNOWN) {
                entry.knownSince(user.getCreatedAt());
            } else {
                entry.changeStatus(Objects.requireNonNull(status));
            }
        }

        ImportCounts counts() {
            return new ImportCounts(added, updated, unchanged, overLimit);
        }
    }
}
