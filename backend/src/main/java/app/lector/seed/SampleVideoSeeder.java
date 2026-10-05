package app.lector.seed;

import app.lector.config.AppProperties;
import app.lector.text.Category;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.user.UserRepository;
import app.lector.video.VideoImportService;
import app.lector.video.VideoImportService.VideoImport;
import app.lector.video.YouTubeUrls;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Adds the sample YouTube videos listed in {@code samples/videos.txt} to the community library, owned by the library
 * account that {@link SampleContentSeeder} creates. Transcripts come from YouTube, so this runs in the background
 * after startup; a video that can't be imported now (offline, no captions) is retried on the next start, and one
 * already present is skipped without contacting YouTube.
 */
@Component
public class SampleVideoSeeder {

    private static final Logger log = LoggerFactory.getLogger(SampleVideoSeeder.class);

    private record Sample(Language language, String url, Category category) {}

    private final AppProperties props;
    private final UserRepository users;
    private final TextRepository texts;
    private final VideoImportService videos;
    private final TransactionTemplate tx;
    private final boolean onStartup;

    public SampleVideoSeeder(AppProperties props, UserRepository users, TextRepository texts, VideoImportService videos,
                             PlatformTransactionManager transactions,
                             @Value("${app.seed-videos-on-startup:true}") boolean onStartup) {
        this.props = props;
        this.users = users;
        this.texts = texts;
        this.videos = videos;
        this.tx = transactions == null ? null : new TransactionTemplate(transactions);
        this.onStartup = onStartup;
    }

    /** Runs after the starter texts are seeded (ApplicationRunners finish before the app is ready). */
    @EventListener(ApplicationReadyEvent.class)
    public void seedInBackground() {
        if (onStartup && props.seedSamples()) {
            Thread.ofVirtual().name("sample-video-seeder").start(this::seed);
        }
    }

    /** Imports any listed video the library doesn't have yet; returns how many were added. Never throws. */
    public int seed() {
        if (!props.seedSamples()) {
            return 0;
        }
        Optional<User> library = users.findByEmailIgnoreCase(SampleContentSeeder.LIBRARY_EMAIL);
        if (library.isEmpty()) {
            return 0;
        }
        int added = 0;
        for (Sample sample : samples()) {
            if (seedOne(library.get(), sample)) {
                added++;
            }
        }
        if (added > 0) {
            log.info("Seeded {} sample videos into the community library", added);
        }
        return added;
    }

    private boolean seedOne(User library, Sample sample) {
        try {
            List<Text> existing = texts.findByOwnerIdAndVideoId(library.getId(), YouTubeUrls.videoId(sample.url()));
            if (!existing.isEmpty()) {
                refile(existing, sample.category());
                return false;
            }
            tx.executeWithoutResult(status -> videos.importUnchecked(library,
                    new VideoImport(sample.url(), sample.language(), null, true, null, null, sample.category())));
            return true;
        } catch (RuntimeException e) {
            log.warn("Could not seed sample video {} (will retry on next start): {}", sample.url(), e.getMessage());
            return false;
        }
    }

    /** Seeded before categories existed: file it now. */
    private void refile(List<Text> existing, Category category) {
        for (Text t : existing) {
            if (category != null && t.getCategory() == Category.OTHER) {
                t.setCategory(category);
                texts.save(t);
            }
        }
    }

    private static List<Sample> samples() {
        var resource = new ClassPathResource("samples/videos.txt");
        if (!resource.exists()) {
            return List.of();
        }
        String raw;
        try (InputStream in = resource.getInputStream()) {
            raw = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        List<Sample> out = new ArrayList<>();
        for (String line : raw.split("\\R")) {
            String[] parts = line.strip().split("\\s+", 3);
            if (parts.length >= 2 && !parts[0].startsWith("#")) {
                Category category = parts.length == 3 ? Category.parse(parts[2]) : null;
                out.add(new Sample(Language.fromCode(parts[0]), parts[1], category));
            }
        }
        return out;
    }
}
