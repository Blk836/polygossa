package app.lector.anki;

import app.lector.anki.AnkiSyncService.CardRequest;
import app.lector.user.PlanService;
import app.lector.user.User;
import app.lector.vocab.EntryKind;
import app.lector.vocab.VocabularyEntry;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocab.WordStatus;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class AnkiMerge {

    private record Found(String display, AnkiCardState state, String meaning) {
        Found with(Found other) {
            return new Found(display, AnkiCardState.best(state, other.state), meaning != null ? meaning : other.meaning);
        }
    }

    private final VocabularyRepository vocabulary;
    private final AnkiLinkRepository links;
    private final AnkiSyncRunWordRepository runWords;
    private final PlanService plans;
    private final Clock clock;

    public AnkiMerge(VocabularyRepository vocabulary, AnkiLinkRepository links, AnkiSyncRunWordRepository runWords,
                     PlanService plans, Clock clock) {
        this.vocabulary = vocabulary;
        this.links = links;
        this.runWords = runWords;
        this.plans = plans;
        this.clock = clock;
    }

    void apply(User user, AnkiSyncRun run, AnkiDeck deck, List<CardRequest> cards) {
        Batch batch = new Batch(user, run, deck);
        Map<String, Found> found = batch.read(cards);
        if (!found.isEmpty()) {
            Map<String, VocabularyEntry> entries = vocabulary
                    .findByUserIdAndLanguageAndTermIn(user.getId(), deck.getLanguage(), found.keySet()).stream()
                    .collect(Collectors.toMap(VocabularyEntry::getTerm, Function.identity()));
            Map<Long, AnkiLink> linked = entries.isEmpty() ? Map.of() : links
                    .findForEntries(deck.getId(), entries.values().stream().map(VocabularyEntry::getId).toList())
                    .stream().collect(Collectors.toMap(l -> l.getEntry().getId(), Function.identity()));
            found.forEach((term, f) -> {
                VocabularyEntry entry = entries.get(term);
                if (entry == null) {
                    batch.added(term, f);
                } else {
                    batch.existing(entry, linked.get(entry.getId()), f);
                }
            });
        }
        runWords.saveAll(batch.words);
    }

    private final class Batch {
        private final User user;
        private final AnkiSyncRun run;
        private final AnkiDeck deck;
        private final Instant knownAt;
        private final List<AnkiSyncRunWord> words = new ArrayList<>();
        private long budget;

        Batch(User user, AnkiSyncRun run, AnkiDeck deck) {
            this.user = user;
            this.run = run;
            this.deck = deck;
            this.knownAt = deck.neverSynced() ? user.getCreatedAt() : clock.instant();
            long left = plans.savedWordsLeft(user);
            this.budget = run.isDryRun() && left != Long.MAX_VALUE ? Math.max(0, left - run.getAddedLearning()) : left;
        }

        Map<String, Found> read(List<CardRequest> cards) {
            Map<String, Found> found = new LinkedHashMap<>();
            for (CardRequest card : cards) {
                run.card();
                AnkiCardText.Word word = AnkiCardText.word(card.word(), deck.getLanguage());
                if (word.skip() != null) {
                    record(AnkiOutcome.skipped(word.skip()), card.word() == null ? "" : card.word().strip());
                } else {
                    Found f = new Found(word.display(), AnkiCardState.of(card.type(), card.interval()),
                            AnkiCardText.meaning(card.meaning()));
                    found.merge(word.term(), f, Found::with);
                }
            }
            return found;
        }

        void added(String term, Found f) {
            if (f.state() == AnkiCardState.MATURE) {
                record(AnkiOutcome.ADDED_KNOWN, f.display());
                create(term, f, true);
            } else if (f.state() == AnkiCardState.YOUNG && budget <= 0) {
                record(AnkiOutcome.OVER_LIMIT, f.display());
            } else if (f.state() == AnkiCardState.YOUNG) {
                budget--;
                record(AnkiOutcome.ADDED_LEARNING, f.display());
                create(term, f, false);
            }
        }

        private void create(String term, Found f, boolean known) {
            if (run.isDryRun()) {
                return;
            }
            VocabularyEntry entry = new VocabularyEntry(user, deck.getLanguage(), term, f.display(),
                    term.contains(" ") ? EntryKind.PHRASE : EntryKind.WORD);
            if (known) {
                entry.knownSince(knownAt);
            }
            entry.setDefinition(f.meaning());
            link(vocabulary.save(entry), null, f.state(), known);
        }

        void existing(VocabularyEntry entry, AnkiLink link, Found f) {
            AnkiCardState state = link != null && link.seenIn(run.getId())
                    ? AnkiCardState.best(f.state(), link.getState()) : f.state();
            boolean learning = entry.getStatus() == WordStatus.LEARNING;
            boolean promote = learning && isNews(link, state) && state == AnkiCardState.MATURE;
            if (link == null && learning) {
                record(AnkiOutcome.LEAVE_REVIEW, entry.getDisplayTerm());
            }
            if (promote) {
                record(AnkiOutcome.BECAME_KNOWN, entry.getDisplayTerm());
            }
            if (!run.isDryRun()) {
                update(entry, link, state, promote, f.meaning());
            }
        }

        private static boolean isNews(AnkiLink link, AnkiCardState state) {
            return link == null || state != link.getState();
        }

        private void update(VocabularyEntry entry, AnkiLink link, AnkiCardState state, boolean promote,
                            String meaning) {
            if (promote) {
                entry.knownSince(knownAt);
            }
            if (entry.getDefinition() == null && meaning != null) {
                entry.setDefinition(meaning);
                entry.touch();
            }
            link(entry, link, state, promote);
        }

        private void link(VocabularyEntry entry, AnkiLink existing, AnkiCardState state, boolean promoted) {
            AnkiLink link = existing == null ? new AnkiLink(entry, deck) : existing;
            link.seen(state, run.getId(), promoted);
            links.save(link);
        }

        private void record(AnkiOutcome outcome, String term) {
            run.count(outcome);
            words.add(new AnkiSyncRunWord(run.getId(), outcome, term));
        }
    }
}
