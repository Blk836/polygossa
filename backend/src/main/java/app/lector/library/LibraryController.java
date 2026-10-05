package app.lector.library;

import app.lector.common.ApiException;
import app.lector.text.Category;
import app.lector.text.DifficultyEstimator;
import app.lector.text.LibraryFilter;
import app.lector.text.MediaKind;
import app.lector.text.Text;
import app.lector.text.TextDtos.TextSummary;
import app.lector.text.TextFeature;
import app.lector.text.TextRepository;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.User;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Shared content library: browse public texts, like and bookmark them. */
@RestController
@RequestMapping("/api/library")
public class LibraryController {

    public record LibraryPage(List<TextSummary> items, long total, int page, int size) {}

    /** One Explore shelf: the newest items in a category, and how many there are in all. */
    public record Shelf(Category category, long total, List<TextSummary> items) {}

    static final int SHELF_SIZE = 8;

    private final TextRepository texts;
    private final TextService textService;
    private final TextReactionRepository reactions;
    private final CurrentUser currentUser;
    private final LibraryCards cards;

    public LibraryController(TextRepository texts, TextService textService, TextReactionRepository reactions,
                             CurrentUser currentUser, LibraryCards cards) {
        this.texts = texts;
        this.textService = textService;
        this.reactions = reactions;
        this.currentUser = currentUser;
        this.cards = cards;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public LibraryPage browse(@AuthenticationPrincipal AuthUser principal,
                              @RequestParam(required = false) Language language,
                              @RequestParam(required = false) String level,
                              @RequestParam(required = false) String q,
                              @RequestParam(required = false) MediaKind kind,
                              @RequestParam(required = false) Category category,
                              @RequestParam(required = false) String topic,
                              @RequestParam(defaultValue = "new") String sort,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "20") int size) {
        User user = currentUser.load(principal);
        String lvl = level(level);
        String pattern = q == null || q.isBlank() ? null : "%" + q.strip().toLowerCase(Locale.ROOT) + "%";
        var pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        String tagged = topicPattern(topic);
        Page<Text> result = "popular".equals(sort)
                ? texts.searchPublicPopular(language, lvl, pattern, code(kind), category, tagged, pageable)
                : texts.searchPublicNewest(language, lvl, pattern, code(kind), category, tagged, pageable);
        return new LibraryPage(summaries(user, result.getContent()), result.getTotalElements(), result.getNumber(),
                result.getSize());
    }

    /** Explore's front page: a shelf per category that has public content, in category order. */
    @GetMapping("/shelves")
    @Transactional(readOnly = true)
    public List<Shelf> shelves(@AuthenticationPrincipal AuthUser principal,
                               @RequestParam(required = false) Language language,
                               @RequestParam(required = false) String level,
                               @RequestParam(required = false) MediaKind kind) {
        User user = currentUser.load(principal);
        String lvl = level(level);
        // Ids and categories of everything matching, newest first; only the texts that make a shelf are loaded.
        Map<Category, Long> totals = new EnumMap<>(Category.class);
        Map<Category, List<Long>> shelfIds = new EnumMap<>(Category.class);
        for (TextRepository.ShelfEntry entry : texts.findPublicShelfEntries(language, lvl, code(kind))) {
            Category category = entry.getCategory() == null ? Category.OTHER : entry.getCategory();
            totals.merge(category, 1L, Long::sum);
            List<Long> ids = shelfIds.computeIfAbsent(category, c -> new ArrayList<>());
            if (ids.size() < SHELF_SIZE) {
                ids.add(entry.getId());
            }
        }
        List<Text> all = texts.findAllById(shelfIds.values().stream().flatMap(List::stream).toList());
        // One summaries() call for every shelf, so the viewer's word statuses are loaded once.
        Map<Long, TextSummary> byId = summaries(user, all).stream()
                .collect(Collectors.toMap(TextSummary::id, s -> s));
        List<Shelf> out = new ArrayList<>();
        shelfIds.forEach((category, ids) ->
                out.add(new Shelf(category, totals.get(category), ids.stream().map(byId::get).toList())));
        return out;
    }

    @GetMapping("/bookmarks")
    @Transactional(readOnly = true)
    public List<TextSummary> bookmarks(@AuthenticationPrincipal AuthUser principal,
                                       @RequestParam(required = false) MediaKind kind,
                                       @RequestParam(required = false) Language language,
                                       @RequestParam(required = false) Category category) {
        User user = currentUser.load(principal);
        List<Text> bookmarked = reactions.findByUserAndType(user.getId(), TextReaction.Type.BOOKMARK).stream()
                .map(TextReaction::getText)
                .filter(t -> textService.canRead(user, t))
                .filter(t -> LibraryFilter.matches(t, kind, language, category))
                .toList();
        return summaries(user, bookmarked);
    }

    @PutMapping("/{id}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void like(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        react(principal, id, TextReaction.Type.LIKE);
    }

    @DeleteMapping("/{id}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void unlike(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        unreact(principal, id, TextReaction.Type.LIKE);
    }

    @PutMapping("/{id}/bookmark")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void bookmark(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        react(principal, id, TextReaction.Type.BOOKMARK);
    }

    @DeleteMapping("/{id}/bookmark")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void unbookmark(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        unreact(principal, id, TextReaction.Type.BOOKMARK);
    }

    private static String level(String level) {
        String lvl = level == null || level.isBlank() ? null : level.toUpperCase(Locale.ROOT);
        if (lvl != null && !DifficultyEstimator.LEVELS.contains(lvl)) {
            throw ApiException.badRequest("level must be one of " + DifficultyEstimator.LEVELS);
        }
        return lvl;
    }

    /** A LIKE pattern for items tagged with this topic; null for no topic filter. */
    private static String topicPattern(String topic) {
        if (topic == null || topic.isBlank()) {
            return null;
        }
        String normalised = TextFeature.normaliseTopic(topic);
        if (normalised == null) {
            throw ApiException.badRequest("topic must be 1–40 letters, digits, spaces, hyphens or apostrophes");
        }
        return TextFeature.topicPattern(normalised);
    }

    private static String code(MediaKind kind) {
        return kind == null ? null : kind.code();
    }

    private void react(AuthUser principal, Long textId, TextReaction.Type type) {
        User user = currentUser.load(principal);
        Text text = textService.loadReadable(user, textId);
        if (reactions.findByUserIdAndTextIdAndType(user.getId(), textId, type).isEmpty()) {
            reactions.save(new TextReaction(user, text, type));
        }
    }

    private void unreact(AuthUser principal, Long textId, TextReaction.Type type) {
        User user = currentUser.load(principal);
        reactions.findByUserIdAndTextIdAndType(user.getId(), textId, type).ifPresent(reactions::delete);
    }

    private List<TextSummary> summaries(User user, List<Text> page) {
        return cards.summaries(user, page, new HashMap<>());
    }
}
