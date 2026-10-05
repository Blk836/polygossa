package app.lector.user;

import app.lector.config.Brand;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * The system account that owns the community library's own content: the starter texts and curated videos. It exists
 * only to own content and can't be logged into.
 */
@Component
public class LibraryAccount {

    public static final String EMAIL = "library@lector.local";

    private final UserRepository users;
    private final Brand brand;
    private final PasswordEncoder passwordEncoder;

    public LibraryAccount(UserRepository users, Brand brand, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.brand = brand;
        this.passwordEncoder = passwordEncoder;
    }

    public Optional<User> find() {
        return users.findByEmailIgnoreCase(EMAIL);
    }

    /** Call inside a transaction. */
    public User getOrCreate() {
        // Random password: nobody logs into this account.
        return find().orElseGet(() -> users.save(new User(EMAIL, passwordEncoder.encode(UUID.randomUUID().toString()),
                brand.libraryName())));
    }
}
