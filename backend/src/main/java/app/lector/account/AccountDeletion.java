package app.lector.account;

import app.lector.billing.BillingService;
import app.lector.common.ApiException;
import app.lector.storage.StorageService;
import app.lector.text.TextService;
import app.lector.user.User;
import app.lector.user.UserRepository;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountDeletion {

    static final List<String> OWN_ROWS = List.of(
            "ai_usage", "anki_links", "anki_sync_runs", "anki_decks", "playlist_bookmarks", "reading_progress",
            "reading_sessions", "recommendation_events", "review_logs", "sentence_cards", "text_dismissals", "text_reactions", "user_days", "user_interests",
            "vocabulary_entries", "word_imports", "words_read", "writing_submissions", "writing_tests",
            "subscriptions");

    private final JdbcTemplate jdbc;
    private final EntityManager em;
    private final TextService texts;
    private final StorageService storage;
    private final UserRepository users;
    private final BillingService billing;

    public AccountDeletion(JdbcTemplate jdbc, EntityManager em, TextService texts, StorageService storage,
                           UserRepository users, BillingService billing) {
        this.billing = billing;
        this.jdbc = jdbc;
        this.em = em;
        this.texts = texts;
        this.storage = storage;
        this.users = users;
    }

    @Transactional
    public void delete(User user, String confirmEmail) {
        if (confirmEmail == null || !confirmEmail.trim().equalsIgnoreCase(user.getEmail())) {
            throw ApiException.badRequest("Type your account's email to confirm");
        }
        billing.cancelForDeletion(user);
        long id = user.getId();
        for (Long text : jdbc.queryForList("select id from texts where owner_id = ?", Long.class, id)) {
            texts.delete(user, text);
        }
        em.flush();
        deletePlaylists(id);
        deleteClassesTaught(id);
        deleteForumContent(id);
        for (String table : OWN_ROWS) {
            jdbc.update("delete from " + table + " where user_id = ?", id);
        }
        jdbc.update("delete from classroom_members where student_id = ?", id);
        jdbc.update("update admin_actions set target_user_id = null, target_email = null where target_user_id = ?", id);
        storage.delete(user.getPhotoFile());
        users.delete(user);
        em.flush();
    }

    private void deletePlaylists(long id) {
        String owned = "(select id from playlists where owner_id = ?)";
        jdbc.update("delete from playlist_bookmarks where playlist_id in " + owned, id);
        jdbc.update("delete from playlist_items where playlist_id in " + owned, id);
        jdbc.update("delete from playlists where owner_id = ?", id);
    }

    private void deleteClassesTaught(long id) {
        String taught = "(select id from classrooms where teacher_id = ?)";
        jdbc.update("delete from assignments where classroom_id in " + taught, id);
        jdbc.update("delete from classroom_members where classroom_id in " + taught, id);
        jdbc.update("delete from classrooms where teacher_id = ?", id);
    }

    private void deleteForumContent(long id) {
        List<Long> repliedTo = jdbc.queryForList(
                "select distinct thread_id from forum_posts where author_id = ?", Long.class, id);
        jdbc.update("delete from forum_posts where thread_id in (select id from forum_threads where author_id = ?)", id);
        jdbc.update("delete from forum_posts where author_id = ?", id);
        jdbc.update("delete from forum_threads where author_id = ?", id);
        for (Long thread : repliedTo) {
            jdbc.update("update forum_threads set reply_count = greatest(0, (select count(*) from forum_posts"
                    + " where thread_id = ?) - 1) where id = ?", thread, thread);
        }
    }
}
