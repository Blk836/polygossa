package app.lector.user;

import app.lector.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Loads the {@link User} entity for the authenticated principal. */
@Component
public class CurrentUser {

    private final UserRepository users;

    public CurrentUser(UserRepository users) {
        this.users = users;
    }

    public User load(AuthUser principal) {
        if (principal == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Not signed in");
        }
        return users.findById(principal.id())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Account no longer exists"));
    }
}
