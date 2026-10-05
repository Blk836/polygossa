package app.lector.user;

import app.lector.common.ApiException;
import app.lector.config.AppProperties;
import app.lector.config.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
            @Size(max = 80) String displayName) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record AuthResponse(String token, MeDto user) {}

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PlanService plans;
    private final AppProperties props;

    public AuthController(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService,
                          PlanService plans, AppProperties props) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.plans = plans;
        this.props = props;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AuthResponse signup(@Valid @RequestBody SignupRequest req) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("An account with that email already exists");
        }
        String name = req.displayName() == null || req.displayName().isBlank()
                ? email.substring(0, email.indexOf('@'))
                : req.displayName().trim();
        User user = users.save(new User(email, passwordEncoder.encode(req.password()), name));
        return respond(user);
    }

    @PostMapping("/login")
    @Transactional(readOnly = true)
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        User user = users.findByEmailIgnoreCase(req.email().trim())
                .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials",
                        "Incorrect email or password"));
        return respond(user);
    }

    /**
     * Development auto-login: signs in to (creating if needed) a test account with every feature unlocked.
     * Returns 404 unless {@code app.dev-auto-login} is enabled, which the prod profile never does.
     */
    @PostMapping("/dev-login")
    @Transactional
    public AuthResponse devLogin() {
        if (!props.devAutoLogin()) {
            throw ApiException.notFound("Endpoint");
        }
        User user = users.findByEmailIgnoreCase(DEV_EMAIL).orElseGet(() -> {
            // Random password: nobody logs into this account with credentials.
            User u = new User(DEV_EMAIL, passwordEncoder.encode(UUID.randomUUID().toString()), "Test User");
            u.setTier(Tier.CLASSROOM);
            return users.save(u);
        });
        return respond(user);
    }

    private AuthResponse respond(User user) {
        return new AuthResponse(jwtService.issue(new AuthUser(user.getId(), user.getEmail())), MeDto.of(user, plans));
    }
}
