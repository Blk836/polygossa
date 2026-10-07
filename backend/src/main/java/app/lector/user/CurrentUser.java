package app.lector.user;

import app.lector.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Loads the {@link User} entity for the authenticated principal. */
@Component
public class CurrentUser {

    private final UserRepository users;
    private final ActiveDays activeDays;

    public CurrentUser(UserRepository users, ActiveDays activeDays) {
        this.users = users;
        this.activeDays = activeDays;
    }

    public User load(AuthUser principal) {
        if (principal == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Not signed in");
        }
        User user = users.findById(principal.id())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Account no longer exists"));
        if (user.isSuspended()) {
            throw suspended();
        }
        activeDays.seen(user.getId());
        return user;
    }

    /** What a suspended account gets from every request, and from signing in. */
    public static ApiException suspended() {
        return new ApiException(HttpStatus.FORBIDDEN, "account_suspended",
                "This account is suspended. Contact the team if you think this is a mistake.");
    }
}
