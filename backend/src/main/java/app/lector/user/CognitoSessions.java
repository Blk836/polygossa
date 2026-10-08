package app.lector.user;

import app.lector.common.ApiException;
import app.lector.config.CognitoTokens;
import app.lector.config.CognitoTokens.Identity;
import app.lector.token.NativeLanguage;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Starts a session after a sign-in through Cognito (cognito-login.feature): finds the account linked to the identity,
 * or links the account with the identity's verified email, or creates one, as sign-up did.
 */
@Service
public class CognitoSessions {

    private final CognitoTokens tokens;
    private final UserRepository users;

    public CognitoSessions(CognitoTokens tokens, UserRepository users) {
        this.tokens = tokens;
        this.users = users;
    }

    /** The account for the identity both tokens speak for; {@code nativeLanguage} is the browser's language tag. */
    @Transactional
    public User start(String accessToken, String idToken, String nativeLanguage) {
        if (!tokens.enabled()) {
            throw ApiException.notFound("Endpoint");
        }
        Identity access = tokens.access(accessToken).orElseThrow(CognitoSessions::refused);
        Identity id = tokens.id(idToken).orElseThrow(CognitoSessions::refused);
        if (!access.sub().equals(id.sub()) || !id.emailVerified() || id.email() == null || id.email().isBlank()) {
            throw refused();
        }
        String email = id.email().trim().toLowerCase(Locale.ROOT);
        User user = users.findByCognitoSub(id.sub())
                .map(linked -> followEmail(linked, email))
                .or(() -> link(email, id.sub()))
                .orElseGet(() -> create(email, id.sub(), nativeLanguage));
        if (user.isSuspended()) {
            throw CurrentUser.suspended();
        }
        return user;
    }

    /** Keeps the account's email in step with Cognito's, unless another account already has that email. */
    private User followEmail(User user, String email) {
        if (!user.getEmail().equalsIgnoreCase(email) && !users.existsByEmailIgnoreCase(email)) {
            user.setEmail(email);
        }
        return user;
    }

    private Optional<User> link(String email, String sub) {
        return users.findByEmailIgnoreCase(email).map(user -> {
            user.setCognitoSub(sub);
            return user;
        });
    }

    private User create(String email, String sub, String nativeLanguage) {
        User user = new User(email, null, email.substring(0, email.indexOf('@')));
        user.setCognitoSub(sub);
        user.setNativeLanguage(NativeLanguage.fromBrowser(nativeLanguage));
        user.setToursOn(true);
        return users.save(user);
    }

    private static ApiException refused() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "invalid_login", "Sign-in failed. Please sign in again.");
    }
}
