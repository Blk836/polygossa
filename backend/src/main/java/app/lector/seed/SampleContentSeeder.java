package app.lector.seed;

import app.lector.config.AppProperties;
import app.lector.config.Brand;
import app.lector.text.Category;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.user.UserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds one short beginner text per language into the community library, owned by a system account, so a new
 * user can start reading within seconds of signing up (onboarding picks from these).
 */
@Component
public class SampleContentSeeder implements ApplicationRunner {

    public static final String LIBRARY_EMAIL = "library@lector.local";

    private static final Logger log = LoggerFactory.getLogger(SampleContentSeeder.class);
    private static final String CATEGORY_PREFIX = "category:";

    private record Starter(Language language, String title, Category category, String body) {}

    private final AppProperties props;
    private final Brand brand;
    private final UserRepository users;
    private final TextService texts;
    private final TextRepository repository;
    private final PasswordEncoder passwordEncoder;

    public SampleContentSeeder(AppProperties props, Brand brand, UserRepository users, TextService texts,
                               TextRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.props = props;
        this.brand = brand;
        this.users = users;
        this.texts = texts;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        if (!props.seedSamples()) {
            return;
        }
        Optional<User> existing = users.findByEmailIgnoreCase(LIBRARY_EMAIL);
        if (existing.isPresent()) {
            existing.get().setDisplayName(brand.libraryName()); // follows a brand rename
            refile(existing.get());
            return;
        }
        // Random password: the account exists only to own shared starter content and can't be logged into.
        User library = users.save(new User(LIBRARY_EMAIL, passwordEncoder.encode(UUID.randomUUID().toString()),
                brand.libraryName()));
        List<Starter> starters = starters();
        for (Starter s : starters) {
            texts.createUnchecked(library, s.title(), s.language(), s.body(), null, true, null).setCategory(s.category());
        }
        log.info("Seeded {} starter texts into the community library", starters.size());
    }

    /** Databases seeded before categories existed: file the starter texts that are still uncategorised. */
    private void refile(User library) throws IOException {
        for (Starter s : starters()) {
            for (Text t : repository.findByOwnerIdAndLanguageAndTitle(library.getId(), s.language(), s.title())) {
                if (t.getCategory() == Category.OTHER) {
                    t.setCategory(s.category());
                }
            }
        }
    }

    /** {@code samples/<code>.txt}: the title, a {@code category: <code>} line, then the text. */
    private static List<Starter> starters() throws IOException {
        List<Starter> out = new ArrayList<>();
        for (Language language : Language.values()) {
            var resource = new ClassPathResource("samples/" + language.code() + ".txt");
            if (!resource.exists()) {
                continue;
            }
            String raw;
            try (InputStream in = resource.getInputStream()) {
                raw = new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
            }
            String[] parts = raw.split("\n", 3);
            if (parts.length < 3 || !parts[1].startsWith(CATEGORY_PREFIX)) {
                throw new IllegalStateException(resource.getPath() + ": the second line must be 'category: <code>'");
            }
            Category category = Category.parse(parts[1].substring(CATEGORY_PREFIX.length()));
            out.add(new Starter(language, parts[0].strip(), category, parts[2]));
        }
        return out;
    }
}
