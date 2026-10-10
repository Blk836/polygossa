package app.lector.admin;

import app.lector.common.ApiException;
import app.lector.forum.ForumPostRepository;
import app.lector.forum.ForumService;
import app.lector.playlist.Playlist;
import app.lector.playlist.PlaylistRepository;
import app.lector.playlist.PlaylistService;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.Admins;
import app.lector.user.LibraryAccount;
import app.lector.user.Tier;
import app.lector.user.User;
import app.lector.user.UserDayRepository;
import app.lector.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminUsers {

    static final int PAGE_SIZE = 25;
    private static final List<Language> ALL_LANGUAGES = List.of(Language.values());

    public record UserRow(Long id, String email, String displayName, Tier plan, Instant createdAt,
                          LocalDate lastActive, boolean suspended, boolean admin, long texts, long playlists,
                          long posts) {}

    public record UserPage(List<UserRow> items, long total, int page, int size) {}

    public record Item(Long id, String title, boolean isPublic, String kind) {}

    public record UserDetail(UserRow user, String suspendedReason, List<Item> texts, List<Item> playlists) {}

    public record Stores(UserRepository users, UserDayRepository userDays, TextRepository texts,
                         PlaylistRepository playlists, ForumPostRepository posts) {}

    private final Stores stores;
    private final TextService textService;
    private final PlaylistService playlistService;
    private final ForumService forum;
    private final AdminLog log;
    private final Admins admins;

    public AdminUsers(UserRepository users, UserDayRepository userDays, TextRepository texts,
                      PlaylistRepository playlists, ForumPostRepository posts, TextService textService,
                      PlaylistService playlistService, ForumService forum, AdminLog log, Admins admins) {
        this.stores = new Stores(users, userDays, texts, playlists, posts);
        this.textService = textService;
        this.playlistService = playlistService;
        this.forum = forum;
        this.log = log;
        this.admins = admins;
    }

    @Transactional(readOnly = true)
    public UserPage search(String q, int page) {
        String pattern = q == null || q.isBlank() ? null : "%" + q.strip().toLowerCase(Locale.ROOT) + "%";
        var found = stores.users().search(pattern, PageRequest.of(Math.max(0, page), PAGE_SIZE,
                Sort.by("createdAt").descending().and(Sort.by("id").descending())));
        return new UserPage(found.map(this::row).getContent(), found.getTotalElements(), found.getNumber(), PAGE_SIZE);
    }

    @Transactional(readOnly = true)
    public UserDetail detail(Long id) {
        User user = load(id);
        List<Item> textItems = stores.texts().findByOwnerIdOrderByCreatedAtDesc(id).stream()
                .map(t -> new Item(t.getId(), t.getTitle(), t.isPublic(), t.getVideoId() == null ? "text" : "video"))
                .toList();
        List<Item> playlistItems = stores.playlists().findMine(id, ALL_LANGUAGES).stream()
                .map(p -> new Item(p.getId(), p.getTitle(), p.isPublic(), "playlist")).toList();
        return new UserDetail(row(user), user.getSuspendedReason(), textItems, playlistItems);
    }

    @Transactional
    public UserRow suspend(User admin, Long id, String reason) {
        User user = load(id);
        if (admins.isAdmin(user) || isLibrary(user)) {
            throw ApiException.badRequest("Admins and the community library can't be suspended");
        }
        String why = reason == null || reason.isBlank() ? "No reason given" : reason.strip();
        user.setSuspended(true, why.substring(0, Math.min(why.length(), 500)));
        log.record(admin, "suspend", user, user.getSuspendedReason());
        return row(user);
    }

    @Transactional
    public UserRow unsuspend(User admin, Long id) {
        User user = load(id);
        user.setSuspended(false, null);
        log.record(admin, "unsuspend", user, null);
        return row(user);
    }

    @Transactional
    public ForumService.Removed removePosts(User admin, Long id) {
        User user = load(id);
        ForumService.Removed removed = forum.removeAllBy(user);
        log.record(admin, "posts", user, removed.posts() + " posts, " + removed.threads() + " threads");
        return removed;
    }

    @Transactional
    public Map<String, Integer> removePlaylists(User admin, Long id) {
        User user = notLibrary(load(id));
        List<Playlist> mine = stores.playlists().findMine(id, ALL_LANGUAGES);
        mine.forEach(p -> playlistService.delete(user, p.getId()));
        log.record(admin, "playlists", user, mine.size() + " playlists");
        return Map.of("playlists", mine.size());
    }

    @Transactional
    public Map<String, Integer> removeTexts(User admin, Long id) {
        User user = notLibrary(load(id));
        List<Long> ids = stores.texts().findByOwnerIdOrderByCreatedAtDesc(id).stream().map(Text::getId).toList();
        ids.forEach(textId -> textService.delete(user, textId));
        log.record(admin, "texts", user, ids.size() + " texts");
        return Map.of("texts", ids.size());
    }

    @Transactional
    public Map<String, Integer> unshare(User admin, Long id) {
        User user = load(id);
        List<Text> shared = stores.texts().findByOwnerIdOrderByCreatedAtDesc(id).stream().filter(Text::isPublic)
                .toList();
        List<Playlist> sharedLists = stores.playlists().findMine(id, ALL_LANGUAGES).stream().filter(Playlist::isPublic)
                .toList();
        shared.forEach(t -> t.setPublic(false));
        sharedLists.forEach(p -> p.setPublic(false));
        log.record(admin, "unshare", user, shared.size() + " texts, " + sharedLists.size() + " playlists");
        return Map.of("texts", shared.size(), "playlists", sharedLists.size());
    }

    @Transactional
    public void removeText(User admin, Long textId) {
        Text text = stores.texts().findById(textId).orElseThrow(() -> ApiException.notFound("Text"));
        User owner = text.getOwner();
        String title = text.getTitle();
        textService.delete(owner, textId);
        log.record(admin, "text", owner, title);
    }

    @Transactional
    public UserRow changePlan(User admin, Long id, Tier tier) {
        User user = load(id);
        user.setTier(tier);
        log.record(admin, "plan", user, tier.name());
        return row(user);
    }

    private User load(Long id) {
        return stores.users().findById(id).orElseThrow(() -> ApiException.notFound("User"));
    }

    private static boolean isLibrary(User user) {
        return LibraryAccount.EMAIL.equalsIgnoreCase(user.getEmail());
    }

    private static User notLibrary(User user) {
        if (isLibrary(user)) {
            throw ApiException.badRequest("The community library can't be emptied from the admin panel");
        }
        return user;
    }

    private UserRow row(User u) {
        Long id = u.getId();
        return new UserRow(id, u.getEmail(), u.getDisplayName(), u.getTier(), u.getCreatedAt(),
                stores.userDays().lastDay(id), u.isSuspended(), admins.isAdmin(u), stores.texts().countByOwnerId(id),
                stores.playlists().countByOwnerId(id), stores.posts().countByAuthorId(id));
    }
}
