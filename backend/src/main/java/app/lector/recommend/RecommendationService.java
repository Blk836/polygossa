package app.lector.recommend;

import app.lector.ai.EmbeddingClient;
import app.lector.level.SkillLevelService;
import app.lector.library.LibraryCards;
import app.lector.library.TextReactionRepository;
import app.lector.progress.ReadingProgress;
import app.lector.recommend.FeatureCache.Features;
import app.lector.recommend.LearnerSignals.Snapshot;
import app.lector.recommend.Recommendations.Anchor;
import app.lector.recommend.Recommendations.Item;
import app.lector.recommend.Recommendations.Shelf;
import app.lector.recommend.ShelfBuilder.Pick;
import app.lector.recommend.TasteProfile.Engaged;
import app.lector.text.Text;
import app.lector.text.TextDtos.TextSummary;
import app.lector.text.TextRepository;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.vocab.WordStatus;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecommendationService {

    private static final Duration RECENT_LIKES = Duration.ofDays(30);

    private final LearnerSignals signals;
    private final TextRepository texts;
    private final TextService textService;
    private final TextReactionRepository reactions;
    private final FeatureCache features;
    private final EmbeddingClient embeddings;
    private final SkillLevelService levels;
    private final LibraryCards cards;
    private final Clock clock;
    private final RecommendProperties props;
    private final ActiveWeights active;

    public RecommendationService(LearnerSignals signals, TextRepository texts, TextService textService,
                                 TextReactionRepository reactions, FeatureCache features, EmbeddingClient embeddings,
                                 SkillLevelService levels, LibraryCards cards, Clock clock, ActiveWeights active) {
        this.signals = signals;
        this.texts = texts;
        this.textService = textService;
        this.reactions = reactions;
        this.features = features;
        this.embeddings = embeddings;
        this.levels = levels;
        this.cards = cards;
        this.clock = clock;
        this.active = active;
        this.props = active.ranking();
    }

    private record Context(User user, Instant now, Snapshot snapshot, Map<Long, Text> engagedTexts,
                           Map<Long, Features> features, TasteProfile profile) {}

    @Transactional(readOnly = true)
    public Recommendations recommend(User user, Language language) {
        RecommendProperties ranking = active.ranking();
        Instant now = clock.instant();
        Snapshot s = signals.load(user);
        List<Text> pool = texts.findPublicCandidates(Language.scope(language), user.getId()).stream()
                .filter(t -> !s.progress().containsKey(t.getId()) && !s.dismissed().contains(t.getId()))
                .sorted(Comparator.comparing(Text::getId)).toList();
        Map<Long, Text> engaged = texts.findAllById(s.activity().keySet()).stream()
                .collect(Collectors.toMap(Text::getId, t -> t));
        Set<Long> ids = new HashSet<>(engaged.keySet());
        pool.forEach(t -> ids.add(t.getId()));
        Map<Long, Features> feats = features.get(ids, embeddings.model());
        Context ctx = new Context(user, now, s, engaged, feats, profile(s, engaged, feats, pool, now));

        String level = language == null ? null : levels.levels(user, language).reading().level();
        Map<Language, Map<String, WordStatus>> statusCache = new HashMap<>();
        List<Candidate> candidates = candidates(ctx, pool, level, statusCache, ranking);

        Map<ShelfId, Shelf> built = new LinkedHashMap<>();
        Map<Long, Text> shown = pool.stream().collect(Collectors.toMap(Text::getId, t -> t));
        List<ReadingProgress> continuing = continuing(ctx, language);
        continuing.forEach(p -> shown.put(p.getTextId(), p.getText()));
        Map<Long, TextSummary> summaries = new HashMap<>();
        Function<List<Pick>, List<Item>> items = picks -> picks.stream()
                .map(p -> new Item(summaries.get(p.candidate().id()), p.reason(),
                        p.candidate().parts() == null ? null : ScoreParts.of(p.candidate().parts()))).toList();

        List<Pick> continuePicks = continuing.stream().map(p -> new Pick(stub(p.getTextId()),
                Reason.progress(p.getPercent()))).toList();
        List<Pick> forYou = ShelfBuilder.forYou(candidates, ctx.profile(), ranking, level != null);
        Anchor anchor = anchor(ctx);
        List<Pick> because = anchor == null ? List.of() : ShelfBuilder.because(anchor.id(),
                feats.get(anchor.id()).vector(), anchor.title(), anchor.liked(), candidates, ranking);
        var topic = ShelfBuilder.topic(ctx.profile(), candidates, ranking);
        List<Pick> justRight = ShelfBuilder.justRight(candidates, ranking);
        List<Pick> stretch = ShelfBuilder.stretch(candidates, ctx.profile(), ranking);

        List<Text> used = new ArrayList<>();
        for (List<Pick> picks : List.of(continuePicks, forYou, because, topic.map(ShelfBuilder.TopicShelf::picks)
                .orElse(List.of()), justRight, stretch)) {
            picks.forEach(p -> used.add(shown.get(p.candidate().id())));
        }
        cards.summaries(user, used.stream().distinct().toList(), statusCache)
                .forEach(summary -> summaries.put(summary.id(), summary));

        add(built, new Shelf(ShelfId.CONTINUE, null, null, null, items.apply(continuePicks)));
        add(built, new Shelf(ShelfId.FOR_YOU, null, null, null, items.apply(forYou)));
        add(built, new Shelf(ShelfId.BECAUSE, null, null, anchor, items.apply(because)));
        topic.ifPresent(t -> add(built, new Shelf(ShelfId.TOPIC, t.topic(), t.category(), null, items.apply(t.picks()))));
        add(built, new Shelf(ShelfId.JUST_RIGHT, null, null, null, items.apply(justRight)));
        add(built, new Shelf(ShelfId.STRETCH, null, null, null, items.apply(stretch)));
        return new Recommendations(language, List.copyOf(built.values()));
    }

    private static void add(Map<ShelfId, Shelf> shelves, Shelf shelf) {
        if (!shelf.items().isEmpty()) {
            shelves.put(shelf.id(), shelf);
        }
    }

    private static Candidate stub(long id) {
        return new Candidate(id, null, null, null, 0, 0, List.of(), null, null, 0, 0, false);
    }

    private TasteProfile profile(Snapshot s, Map<Long, Text> engaged, Map<Long, Features> feats, List<Text> pool,
                                 Instant now) {
        List<Engaged> history = new ArrayList<>();
        s.activity().forEach((id, activity) -> {
            Text t = engaged.get(id);
            if (t != null) {
                Features f = feats.getOrDefault(id, Features.NONE);
                history.add(new Engaged(Signals.weight(activity, now, props.halfLifeDays()), f.vector(), f.topics(),
                        t.getCategory(), t.isVideo(), t.getWordCount()));
            }
        });
        List<float[]> interestVectors = pool.stream().filter(t -> s.interests().contains(t.getCategory()))
                .map(t -> feats.getOrDefault(t.getId(), Features.NONE).vector()).filter(v -> v != null).toList();
        return TasteProfile.of(history, s.interests(), interestVectors);
    }

    private List<Candidate> candidates(Context ctx, List<Text> pool, String level,
                                       Map<Language, Map<String, WordStatus>> statusCache, RecommendProperties ranking) {
        Map<Long, Long> likes = pool.isEmpty() ? Map.of() : reactions.likeCountsSince(
                pool.stream().map(Text::getId).toList(), ctx.now().minus(RECENT_LIKES)).stream()
                .collect(Collectors.toMap(TextReactionRepository.TextCount::getTextId,
                        TextReactionRepository.TextCount::getCount));
        CandidateScorer scorer = new CandidateScorer(ctx.profile(), level, ctx.now(), ranking);
        return pool.stream().map(t -> scorer.score(t, textService.statsFor(ctx.user(), t, statusCache),
                ctx.features().getOrDefault(t.getId(), Features.NONE), likes.getOrDefault(t.getId(), 0L),
                ctx.snapshot().tallies().get(t.getId()))).toList();
    }

    private List<ReadingProgress> continuing(Context ctx, Language language) {
        return ctx.snapshot().progress().values().stream()
                .filter(p -> !p.isCompleted() && !Signals.abandoned(p.getPercent(), false, p.getUpdatedAt(), ctx.now()))
                .filter(p -> language == null || p.getText().getLanguage() == language)
                .filter(p -> textService.canRead(ctx.user(), p.getText()))
                .sorted(Comparator.comparing(ReadingProgress::getUpdatedAt).reversed()
                        .thenComparing(ReadingProgress::getTextId))
                .limit(props.shelfSize()).toList();
    }

    private Anchor anchor(Context ctx) {
        Anchor best = null;
        Instant bestAt = null;
        for (var e : ctx.snapshot().activity().entrySet()) {
            Signals.Activity a = e.getValue();
            Instant finished = a.completed() ? a.progressAt() : null;
            Instant at = latest(finished, a.likedAt());
            Text t = ctx.engagedTexts().get(e.getKey());
            boolean embedded = ctx.features().getOrDefault(e.getKey(), Features.NONE).vector() != null;
            if (at != null && t != null && embedded && (bestAt == null || at.isAfter(bestAt))) {
                best = new Anchor(t.getId(), t.getTitle(), at.equals(a.likedAt()));
                bestAt = at;
            }
        }
        return best;
    }

    private static Instant latest(Instant a, Instant b) {
        if (a == null) {
            return b;
        }
        return b == null || a.isAfter(b) ? a : b;
    }
}
