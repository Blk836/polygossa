package app.lector.user;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The team: the emails named in {@code app.forum.admins} (FORUM_ADMINS). They moderate the forum and use the admin
 * panel; there are no other roles.
 */
@Component
public class Admins {

    private final List<String> emails;

    public Admins(@Value("${app.forum.admins:}") List<String> emails) {
        this.emails = emails.stream().map(String::strip).filter(e -> !e.isEmpty()).toList();
    }

    public boolean isAdmin(User user) {
        return user != null && emails.stream().anyMatch(e -> e.equalsIgnoreCase(user.getEmail()));
    }
}
