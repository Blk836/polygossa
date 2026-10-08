package app.lector.user;

import app.lector.common.ApiException;
import app.lector.config.AppProperties;
import app.lector.config.JwtService;
import app.lector.config.LoginProperties;
import app.lector.token.NativeLanguage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public static final String DEV_EMAIL = "test@lector.local";

    public record SignupRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 200) String password,
            @Size(max = 80) String displayName,
            /* the browser's language tag; becomes the native language when it is one we offer, else English */
            @Size(max = 35) String nativeLanguage) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record AuthResponse(String token, MeDto user) {}

    /** The ID token from the same sign-in, and the browser's language tag (the native language of a new account). */
    public record CognitoSessionRequest(@NotBlank String idToken, @Size(max = 35) String nativeLanguage) {}

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PlanService plans;
    private final Admins admins;
    private final AppProperties props;
    private final LoginProperties login;
    private final CognitoSessions cognitoSessions;

    public AuthController(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService,
                          PlanService plans, AppProperties props, Admins admins, LoginProperties login,
                          CognitoSessions cognitoSessions) {
        this.login = login;
        this.cognitoSessions = cognitoSessions;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.plans = plans;
        this.admins = admins;
        this.props = props;
    }

    /** After a sign-in through Cognito: the account for its tokens (the access token signs the request). */
    @PostMapping("/cognito")
    @Transactional
    public MeDto cognito(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                         @Valid @RequestBody CognitoSessionRequest req) {
        String access = authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7) : null;
        return MeDto.of(cognitoSessions.start(access, req.idToken(), req.nativeLanguage()), plans, admins);
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AuthResponse signup(@Valid @RequestBody SignupRequest req) {
        requireLocalAccounts();
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("An account with that email already exists");
        }
        String name = req.displayName() == null || req.displayName().isBlank()
                ? email.substring(0, email.indexOf('@'))
                : req.displayName().trim();
        User created = new User(email, passwordEncoder.encode(req.password()), name);
        created.setNativeLanguage(NativeLanguage.fromBrowser(req.nativeLanguage()));
        created.setToursOn(true);
        User user = users.save(created);
        return respond(user);
    }

    @PostMapping("/login")
    @Transactional(readOnly = true)
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        requireLocalAccounts();
        User user = users.findByEmailIgnoreCase(req.email().trim())
                .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials",
                        "Incorrect email or password"));
        if (user.isSuspended()) {
            throw CurrentUser.suspended();
        }
        return respond(user);
    }

    /**
     * Development auto-login: signs in to (creating if needed) a test account with every feature unlocked.
     * Returns 404 unless {@code app.dev-auto-login} is enabled, which the prod profile never does.
     */
    @PostMapping("/dev-login")
    public AuthResponse devLogin() {
        if (!props.devAutoLogin()) {
            throw ApiException.notFound("Endpoint");
        }
        requireLocalAccounts();
        User user = users.findByEmailIgnoreCase(DEV_EMAIL).orElseGet(this::createDevAccount);
        return respond(user);
    }

    /**
     * Creates the test account (each save is its own transaction). Several first visits can arrive at once on a fresh
     * database: the one that loses the race to insert it reads the winner's account instead of failing.
     */
    private User createDevAccount() {
        // Random password: nobody logs into this account with credentials.
        User u = new User(DEV_EMAIL, passwordEncoder.encode(UUID.randomUUID().toString()), "Test User");
        u.setTier(Tier.CLASSROOM);
        try {
            return users.saveAndFlush(u);
        } catch (DataIntegrityViolationException e) {
            return users.findByEmailIgnoreCase(DEV_EMAIL).orElseThrow(() -> e);
        }
    }

    /** The app's own accounts are off in production, where everyone signs in through Cognito. */
    private void requireLocalAccounts() {
        if (!login.localAccounts()) {
            throw ApiException.notFound("Endpoint");
        }
    }

    private AuthResponse respond(User user) {
        return new AuthResponse(jwtService.issue(new AuthUser(user.getId(), user.getEmail())), MeDto.of(user, plans, admins));
    }
}
