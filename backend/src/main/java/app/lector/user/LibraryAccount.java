package app.lector.user;

import app.lector.config.Brand;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

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

    public User getOrCreate() {
        return find().orElseGet(() -> users.save(new User(EMAIL, passwordEncoder.encode(UUID.randomUUID().toString()),
                brand.libraryName())));
    }
}
