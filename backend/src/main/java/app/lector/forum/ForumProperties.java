package app.lector.forum;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** The forum (app.forum.*): {@code admins} are the emails of the team, who post announcements and moderate. */
@ConfigurationProperties(prefix = "app.forum")
public record ForumProperties(@DefaultValue List<String> admins) {

    public boolean isAdmin(String email) {
        return email != null && admins.stream().anyMatch(a -> a.strip().equalsIgnoreCase(email));
    }
}
