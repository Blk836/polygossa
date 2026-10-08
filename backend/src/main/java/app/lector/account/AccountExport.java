package app.lector.account;

import app.lector.user.User;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Download my data (docs/acceptance/gdpr.feature): everything stored about the account as one machine-readable
 * file, one section per kind of record with the database's own field names. Leaves out the password's hash, and
 * other people's data (their replies in this account's threads, the team's moderation notes).
 */
@Service
public class AccountExport {

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public AccountExport(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> export(User user) {
        long id = user.getId();
        Map<String, Object> file = new LinkedHashMap<>();
        file.put("exportedAt", clock.instant().toString());
        Map<String, Object> account = jdbc.queryForMap("select * from users where id = ?", id);
        account.remove("password_hash");
        file.put("account", account);
        file.put("texts", rows("select t.*, b.content from texts t join text_bodies b on b.id = t.body_id"
                + " where t.owner_id = ? order by t.id", id));
        for (String table : AccountDeletion.OWN_ROWS) {
            file.put(table, rows("select * from " + table + " where user_id = ? order by 1", id));
        }
        file.put("playlists", rows("select * from playlists where owner_id = ? order by id", id));
        file.put("playlist_items", rows("select i.* from playlist_items i join playlists p on p.id = i.playlist_id"
                + " where p.owner_id = ?", id));
        file.put("classes_taught", rows("select * from classrooms where teacher_id = ? order by id", id));
        file.put("class_memberships", rows("select * from classroom_members where student_id = ?", id));
        file.put("forum_threads", rows("select * from forum_threads where author_id = ? order by id", id));
        file.put("forum_posts", rows("select * from forum_posts where author_id = ? order by id", id));
        return file;
    }

    private List<Map<String, Object>> rows(String sql, long id) {
        return jdbc.queryForList(sql, id);
    }
}
