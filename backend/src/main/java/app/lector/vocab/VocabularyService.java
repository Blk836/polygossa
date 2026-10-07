package app.lector.vocab;

import app.lector.common.ApiException;
import app.lector.text.Text;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.token.TokenizationService;
import app.lector.user.PlanService;
import app.lector.user.User;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabularyService {

    /** Fields a client may set when saving or editing an entry; null means "leave unchanged". */
    public record EntryFields(
            WordStatus status,
            String definition,
            String partOfSpeech,
            String pronunciation,
            String example,
            String contextSentence,
            String note,
            List<String> tags) {

        public EntryFields(WordStatus status, String definition, String partOfSpeech, String pronunciation,
                           String example, String contextSentence) {
            this(status, definition, partOfSpeech, pronunciation, example, contextSentence, null, null);
        }

        /** The same fields with tags normalized (a 400 for invalid ones, before anything changes). */
        EntryFields checked() {
            return tags == null ? this : new EntryFields(status, definition, partOfSpeech, pronunciation, example,
                    contextSentence, note, Tags.normalize(tags));
        }
    }

    private final VocabularyRepository repo;
    private final PlanService plans;
    private final TextService texts;

    public VocabularyService(VocabularyRepository repo, PlanService plans, TextService texts) {
        this.repo = repo;
        this.plans = plans;
        this.texts = texts;
    }

    /**
     * Creates or updates the user's entry for a term. Clicking a word in the reader calls this with status
     * "learning"; the popup's buttons call it with "known" or "ignored".
     */
    @Transactional
    public VocabularyEntry save(User user, Language language, String term, String displayTerm, EntryKind kind,
                                EntryFields unchecked, Long textId) {
        EntryFields fields = unchecked.checked();
        String key = TokenizationService.normalize(term, language);
        if (key.isEmpty() || key.length() > 500) {
            throw ApiException.badRequest("term must be 1-500 characters");
        }
        VocabularyEntry entry = repo.findByUserIdAndLanguageAndTerm(user.getId(), language, key)
                .orElseGet(() -> create(user, language, key, displayOrTerm(displayTerm, term), kind, fields.status(), textId));
        changeStatus(user, entry, fields.status());
        applyDetails(entry, fields);
        return entry;
    }

    private VocabularyEntry create(User user, Language language, String key, String display, EntryKind kind,
                                   WordStatus requested, Long textId) {
        WordStatus status = requested == null ? WordStatus.LEARNING : requested;
        if (status == WordStatus.LEARNING) {
            plans.checkCanSaveWord(user);
        }
        EntryKind k = kind != null ? kind : (key.contains(" ") ? EntryKind.PHRASE : EntryKind.WORD);
        // New entries start as LEARNING; save() then applies any other requested status.
        VocabularyEntry entry = new VocabularyEntry(user, language, key, display, k);
        if (textId != null) {
            Text text = texts.load(textId);
            if (texts.canRead(user, text)) {
                entry.setSourceText(text);
            }
        }
        return repo.save(entry);
    }

    private static String displayOrTerm(String displayTerm, String term) {
        String display = displayTerm == null || displayTerm.isBlank() ? term.strip() : displayTerm.strip();
        return display.substring(0, Math.min(display.length(), 500));
    }

    /** Moving a word (back) into "learning" counts against the free-tier saved-word limit. */
    private void changeStatus(User user, VocabularyEntry entry, WordStatus status) {
        if (status == null || status == entry.getStatus()) {
            return;
        }
        if (status == WordStatus.LEARNING) {
            plans.checkCanSaveWord(user);
        }
        entry.changeStatus(status);
    }

    /**
     * "Finish lesson": every word in the text the user never clicked is marked known (as in LingQ), so the
     * known-word count grows as the user reads. Returns how many words were marked.
     */
    @Transactional
    public int markUnseenKnown(User user, Long id) {
        return markUnseenKnown(user, id, 0, Integer.MAX_VALUE);
    }

    /**
     * "Turning the page": like {@link #markUnseenKnown(User, Long)} for the tokens from {@code fromToken} to
     * {@code toToken} (inclusive; a range past the end stops at the end).
     */
    @Transactional
    public int markUnseenKnown(User user, Long id, int fromToken, int toToken) {
        if (fromToken < 0 || toToken < fromToken) {
            throw ApiException.badRequest("Invalid token range");
        }
        Text text = texts.loadReadable(user, id);
        Map<String, String> unseen = new LinkedHashMap<>();
        for (Token t : texts.tokens(text)) {
            if (t.word() && t.index() >= fromToken && t.index() <= toToken) {
                unseen.putIfAbsent(t.normalized(), t.text());
            }
        }
        for (var ts : repo.findTermStatuses(user.getId(), text.getLanguage())) {
            unseen.remove(ts.getTerm());
        }
        List<VocabularyEntry> created = new ArrayList<>();
        unseen.forEach((term, display) -> {
            VocabularyEntry entry = new VocabularyEntry(user, text.getLanguage(), term, display, EntryKind.WORD);
            entry.changeStatus(WordStatus.KNOWN);
            entry.setSourceText(text);
            created.add(entry);
        });
        repo.saveAll(created);
        return created.size();
    }

    @Transactional
    public VocabularyEntry update(User user, Long id, EntryFields unchecked) {
        EntryFields fields = unchecked.checked();
        VocabularyEntry entry = loadOwned(user, id);
        changeStatus(user, entry, fields.status());
        applyDetails(entry, fields);
        return entry;
    }

    @Transactional
    public void delete(User user, Long id) {
        repo.delete(loadOwned(user, id));
    }

    static final int MAX_BULK_DELETE = 1000;

    /** Deletes those of {@code ids} that are this learner's entries; others' and unknown ids are ignored. */
    @Transactional
    public int deleteAll(User user, List<Long> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > MAX_BULK_DELETE || ids.contains(null)) {
            throw ApiException.badRequest("ids must hold 1 to " + MAX_BULK_DELETE + " entry ids");
        }
        List<VocabularyEntry> mine = repo.findAllById(ids).stream()
                .filter(e -> e.getUser().getId().equals(user.getId())).toList();
        repo.deleteAllInBatch(mine);
        return mine.size();
    }

    @Transactional
    public void deleteByTerm(User user, Language language, String term) {
        repo.findByUserIdAndLanguageAndTerm(user.getId(), language, TokenizationService.normalize(term, language))
                .ifPresent(repo::delete);
    }

    @Transactional(readOnly = true)
    public Page<VocabularyDto> search(User user, Language language, WordStatus status, EntryKind kind, String q,
                                      String tag, String sort, int page, int size) {
        String pattern = q == null || q.isBlank() ? null : "%" + q.strip().toLowerCase(Locale.ROOT) + "%";
        String tagPattern = tag == null || tag.isBlank() ? null : "% " + tag.strip().toLowerCase(Locale.ROOT) + " %";
        Sort order = switch (sort == null ? "recent" : sort) {
            case "alpha" -> Sort.by("term").ascending();
            case "due" -> Sort.by("srs.dueAt").ascending();
            default -> Sort.by("updatedAt").descending();
        };
        var pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200), order);
        return repo.search(user.getId(), language, status, kind, pattern, tagPattern, pageable).map(VocabularyDto::of);
    }

    /** The learner's tags in a language (all languages when null), with how many entries carry each. */
    @Transactional(readOnly = true)
    public List<Tags.TagCount> tags(User user, Language language) {
        return Tags.count(repo.findTagColumns(user.getId(), language));
    }

    public VocabularyEntry loadOwned(User user, Long id) {
        VocabularyEntry entry = repo.findById(id).orElseThrow(() -> ApiException.notFound("Word"));
        if (!entry.getUser().getId().equals(user.getId())) {
            throw ApiException.notFound("Word");
        }
        return entry;
    }

    private static void applyDetails(VocabularyEntry entry, EntryFields f) {
        boolean changed = false;
        if (f.definition() != null) {
            entry.setDefinition(trim(f.definition(), 4000));
            changed = true;
        }
        if (f.partOfSpeech() != null) {
            entry.setPartOfSpeech(trim(f.partOfSpeech(), 100));
            changed = true;
        }
        if (f.pronunciation() != null) {
            entry.setPronunciation(trim(f.pronunciation(), 200));
            changed = true;
        }
        if (f.example() != null) {
            entry.setExample(trim(f.example(), 2000));
            changed = true;
        }
        // The context sentence records where the word was *first* met, so it is only filled in once.
        if (f.contextSentence() != null && (entry.getContextSentence() == null || entry.getContextSentence().isBlank())) {
            entry.setContextSentence(trim(f.contextSentence(), 2000));
            changed = true;
        }
        if (applyPersonal(entry, f) || changed) {
            entry.touch();
        }
    }

    /** The learner's own note ("" clears it) and tags (null leaves them, [] clears them). */
    private static boolean applyPersonal(VocabularyEntry entry, EntryFields f) {
        if (f.note() != null) {
            entry.setNote(f.note().isBlank() ? null : trim(f.note(), 2000));
        }
        if (f.tags() != null) {
            entry.setTags(f.tags());
        }
        return f.note() != null || f.tags() != null;
    }

    private static String trim(String s, int max) {
        String t = s.strip();
        return t.substring(0, Math.min(t.length(), max));
    }
}
