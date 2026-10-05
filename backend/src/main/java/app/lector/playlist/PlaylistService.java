package app.lector.playlist;

import app.lector.common.ApiException;
import app.lector.playlist.PlaylistDtos.Cover;
import app.lector.playlist.PlaylistDtos.PlaylistDetail;
import app.lector.playlist.PlaylistDtos.PlaylistSummary;
import app.lector.progress.ProgressService;
import app.lector.text.Text;
import app.lector.text.TextDtos.OwnerDto;
import app.lector.text.TextDtos.TextSummary;
import app.lector.text.TextService;
import app.lector.text.VideoViews;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.vocab.WordStatus;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Playlists: owners group texts and videos and may share the group; viewers see only the items they can read. */
@Service
public class PlaylistService {

    static final int MAX_ITEMS = 500;
    static final int SHARED_LIMIT = 60;
    static final int COVERS = 3;

    private final PlaylistRepository playlists;
    private final PlaylistItemRepository items;
    private final PlaylistBookmarkRepository bookmarks;
    private final TextService texts;
    private final ProgressService progress;
    private final Clock clock;

    public PlaylistService(PlaylistRepository playlists, PlaylistItemRepository items,
                           PlaylistBookmarkRepository bookmarks, TextService texts, ProgressService progress,
                           Clock clock) {
        this.playlists = playlists;
        this.items = items;
        this.bookmarks = bookmarks;
        this.texts = texts;
        this.progress = progress;
        this.clock = clock;
    }

    // ---- reading ----

    @Transactional(readOnly = true)
    public List<PlaylistSummary> mine(User user, Language language, Long containing) {
        return summaries(user, playlists.findMine(user.getId(), language), containing);
    }

    /** Shared playlists that have something the viewer can read. */
    @Transactional(readOnly = true)
    public List<PlaylistSummary> shared(User user, Language language, String q) {
        String pattern = q == null || q.isBlank() ? null : "%" + q.strip().toLowerCase(Locale.ROOT) + "%";
        List<Playlist> found = playlists.findShared(language, pattern, PageRequest.of(0, SHARED_LIMIT));
        return summaries(user, found, null).stream().filter(s -> s.itemCount() > 0).toList();
    }

    /** Playlists the user saved and can still see, newest save first. */
    @Transactional(readOnly = true)
    public List<PlaylistSummary> saved(User user, Language language) {
        return summaries(user, bookmarks.findSaved(user.getId(), language), null);
    }

    @Transactional(readOnly = true)
    public PlaylistDetail detail(User user, Long id) {
        Playlist playlist = loadVisible(user, id);
        List<Text> readable = readableTexts(user, items.findForPlaylists(List.of(id)));
        Map<Language, Map<String, WordStatus>> statusCache = new HashMap<>();
        List<TextSummary> summaries = progress.attach(user, readable.stream()
                .map(t -> texts.summarize(user, t, texts.statsFor(user, t, statusCache), null, null, null))
                .toList());
        int privateItems = playlist.isOwnedBy(user) ? (int) readable.stream().filter(t -> !t.isPublic()).count() : 0;
        Set<Long> done = progress.completedTextIds(user, readable.stream().map(Text::getId).toList());
        boolean saved = !bookmarks.savedAmong(user.getId(), List.of(id)).isEmpty();
        return new PlaylistDetail(summary(user, playlist, readable, done, null, saved), summaries, privateItems);
    }

    // ---- changes (owner only) ----

    @Transactional
    public PlaylistSummary create(User user, String title, String description, Language language) {
        if (language == null) {
            throw ApiException.badRequest("A language is required");
        }
        Playlist playlist = new Playlist(user, title(title), language, clock.instant());
        playlist.setDescription(description(description));
        playlists.save(playlist);
        return summary(user, playlist, List.of(), Set.of(), null, false);
    }

    @Transactional
    public PlaylistSummary update(User user, Long id, String title, String description, Boolean isPublic) {
        Playlist playlist = loadOwned(user, id);
        if (title != null) {
            playlist.setTitle(title(title));
        }
        if (description != null) {
            playlist.setDescription(description(description));
        }
        if (isPublic != null) {
            playlist.setPublic(isPublic);
        }
        playlist.setUpdatedAt(clock.instant());
        return summaries(user, List.of(playlist), null).get(0);
    }

    @Transactional
    public void delete(User user, Long id) {
        Playlist playlist = loadOwned(user, id);
        items.deleteByPlaylistId(id);
        bookmarks.deleteByPlaylistId(id);
        playlists.delete(playlist);
    }

    // ---- saving (anyone who can see the playlist) ----

    /** Saves a playlist the user can see; saving one that is already saved changes nothing. */
    @Transactional
    public void bookmark(User user, Long id) {
        Playlist playlist = loadVisible(user, id);
        if (bookmarks.findByUserIdAndPlaylistId(user.getId(), id).isEmpty()) {
            bookmarks.save(new PlaylistBookmark(user, playlist, clock.instant()));
        }
    }

    @Transactional
    public void unbookmark(User user, Long id) {
        bookmarks.findByUserIdAndPlaylistId(user.getId(), id).ifPresent(bookmarks::delete);
    }

    /** Appends a text the owner can read; adding one that is already there changes nothing. */
    @Transactional
    public void addItem(User user, Long id, Long textId) {
        Playlist playlist = loadOwned(user, id);
        Text text = texts.loadReadable(user, textId);
        if (text.getLanguage() != playlist.getLanguage()) {
            throw ApiException.badRequest("This playlist is for " + playlist.getLanguage().displayName() + " only");
        }
        if (items.findOne(id, textId).isPresent()) {
            return;
        }
        if (items.countByPlaylistId(id) >= MAX_ITEMS) {
            throw ApiException.badRequest("A playlist holds at most " + MAX_ITEMS + " items");
        }
        items.save(new PlaylistItem(playlist, text, items.lastPosition(id) + 1));
        playlist.setUpdatedAt(clock.instant());
    }

    @Transactional
    public void removeItem(User user, Long id, Long textId) {
        Playlist playlist = loadOwned(user, id);
        items.findOne(id, textId).ifPresent(item -> {
            items.delete(item);
            playlist.setUpdatedAt(clock.instant());
        });
    }

    /**
     * Puts the items the owner can see in the given order, which must name each of them once; items they can no
     * longer read (someone else's text that stopped being shared) keep their relative order after them.
     */
    @Transactional
    public void reorder(User user, Long id, List<Long> textIds) {
        Playlist playlist = loadOwned(user, id);
        List<PlaylistItem> all = items.findForPlaylists(List.of(id));
        Map<Long, PlaylistItem> visible = all.stream().filter(i -> texts.canRead(user, i.getText()))
                .collect(Collectors.toMap(i -> i.getText().getId(), i -> i));
        if (textIds.size() != visible.size() || !visible.keySet().equals(new HashSet<>(textIds))) {
            throw ApiException.badRequest("The new order must list each item in the playlist once");
        }
        List<PlaylistItem> ordered = new ArrayList<>(textIds.stream().map(visible::get).toList());
        all.stream().filter(i -> !visible.containsKey(i.getText().getId())).forEach(ordered::add);
        for (int i = 0; i < ordered.size(); i++) {
            ordered.get(i).setPosition(i);
        }
        playlist.setUpdatedAt(clock.instant());
    }

    // ---- helpers ----

    /** The owner's playlist, or a shared one; anyone else's private playlist does not exist for them. */
    private Playlist loadVisible(User user, Long id) {
        Playlist playlist = playlists.findById(id).orElseThrow(() -> ApiException.notFound("Playlist"));
        if (!playlist.isOwnedBy(user) && !playlist.isPublic()) {
            throw ApiException.notFound("Playlist");
        }
        return playlist;
    }

    private Playlist loadOwned(User user, Long id) {
        Playlist playlist = loadVisible(user, id);
        if (!playlist.isOwnedBy(user)) {
            throw ApiException.forbidden("Only the owner can change this playlist");
        }
        return playlist;
    }

    private static String title(String title) {
        String t = title == null ? "" : title.strip();
        if (t.isEmpty()) {
            throw ApiException.badRequest("A title is required");
        }
        if (t.length() > Playlist.MAX_TITLE) {
            throw ApiException.badRequest("Titles are limited to " + Playlist.MAX_TITLE + " characters");
        }
        return t;
    }

    private static String description(String description) {
        String d = description == null ? "" : description.strip();
        if (d.length() > Playlist.MAX_DESCRIPTION) {
            throw ApiException.badRequest("Descriptions are limited to " + Playlist.MAX_DESCRIPTION + " characters");
        }
        return d.isEmpty() ? null : d;
    }

    private List<Text> readableTexts(User user, List<PlaylistItem> list) {
        return list.stream().map(PlaylistItem::getText).filter(t -> texts.canRead(user, t)).toList();
    }

    private List<PlaylistSummary> summaries(User user, List<Playlist> list, Long containing) {
        if (list.isEmpty()) {
            return List.of();
        }
        List<Long> ids = list.stream().map(Playlist::getId).toList();
        Set<Long> saved = new HashSet<>(bookmarks.savedAmong(user.getId(), ids));
        Map<Long, List<PlaylistItem>> byPlaylist = items.findForPlaylists(ids).stream().collect(Collectors.groupingBy(i -> i.getPlaylist().getId()));
        Map<Long, List<Text>> readable = new HashMap<>();
        Set<Long> allTexts = new LinkedHashSet<>();
        for (Playlist p : list) {
            List<Text> r = readableTexts(user, byPlaylist.getOrDefault(p.getId(), List.of()));
            readable.put(p.getId(), r);
            r.forEach(t -> allTexts.add(t.getId()));
        }
        Set<Long> done = progress.completedTextIds(user, allTexts);
        return list.stream()
                .map(p -> summary(user, p, readable.get(p.getId()), done, containing, saved.contains(p.getId())))
                .toList();
    }

    private static PlaylistSummary summary(User user, Playlist p, List<Text> readable, Set<Long> done,
                                           Long containing, boolean saved) {
        User owner = p.getOwner();
        int completedCount = (int) readable.stream().filter(t -> done.contains(t.getId())).count();
        String thumbnail = readable.stream().filter(Text::isVideo).findFirst()
                .map(t -> VideoViews.thumbnailUrl(t.getVideoId())).orElse(null);
        Boolean contains = containing == null ? null
                : readable.stream().anyMatch(t -> t.getId().equals(containing));
        List<Cover> covers = readable.stream().limit(COVERS).map(t -> new Cover(t.getId(), t.getTitle(),
                t.isVideo() ? VideoViews.thumbnailUrl(t.getVideoId()) : null, t.getCategory())).toList();
        return new PlaylistSummary(p.getId(), p.getTitle(), p.getDescription(), p.getLanguage(), p.isPublic(),
                new OwnerDto(owner.getId(), owner.getDisplayName()), p.isOwnedBy(user), readable.size(),
                completedCount, thumbnail, covers, p.getCreatedAt(), p.getUpdatedAt(), contains, saved);
    }
}
