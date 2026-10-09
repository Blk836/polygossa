package app.lector.seed;

import app.lector.config.AppProperties;
import app.lector.config.Brand;
import app.lector.text.Category;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.LibraryAccount;
import app.lector.user.User;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SampleContentSeeder implements ApplicationRunner {

    public static final String LIBRARY_EMAIL = LibraryAccount.EMAIL;

    private static final Logger log = LoggerFactory.getLogger(SampleContentSeeder.class);
    private static final String CATEGORY_PREFIX = "category:";

    private record Starter(Language language, String title, Category category, String body) {}

    private final AppProperties props;
    private final Brand brand;
    private final LibraryAccount account;
    private final TextService texts;
    private final TextRepository repository;

    public SampleContentSeeder(AppProperties props, Brand brand, LibraryAccount account, TextService texts,
                               TextRepository repository) {
        this.repository = repository;
        this.props = props;
        this.brand = brand;
        this.account = account;
        this.texts = texts;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        if (!props.seedSamples()) {
            return;
        }
        Optional<User> existing = account.find();
        if (existing.isPresent()) {
            existing.get().setDisplayName(brand.libraryName());
            refile(existing.get());
            addMissing(existing.get());
            return;
        }
        User library = account.getOrCreate();
        List<Starter> starters = starters();
        starters.forEach(s -> create(library, s));
        log.info("Seeded {} starter texts into the community library", starters.size());
    }

    private void create(User library, Starter s) {
        texts.createUnchecked(library, s.title(), s.language(), s.body(), null, true, null).setCategory(s.category());
    }

    private void addMissing(User library) throws IOException {
        for (Starter s : starters()) {
            if (repository.findByOwnerIdAndLanguageAndTitle(library.getId(), s.language(), s.title()).isEmpty()) {
                create(library, s);
                log.info("Added the {} starter text to the community library", s.language().displayName());
            }
        }
    }

    private void refile(User library) throws IOException {
        for (Starter s : starters()) {
            for (Text t : repository.findByOwnerIdAndLanguageAndTitle(library.getId(), s.language(), s.title())) {
                if (t.getCategory() == Category.OTHER) {
                    t.setCategory(s.category());
                }
            }
        }
    }

    private static List<Starter> starters() throws IOException {
        List<Starter> out = new ArrayList<>();
        for (Language language : Language.offered()) {
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
