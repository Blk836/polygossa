package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.config.AppProperties;
import app.lector.seed.SampleContentSeeder;
import app.lector.seed.SampleVideoSeeder;
import app.lector.text.TextRepository;
import app.lector.video.YouTubeStub;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Scenarios for the seeded sample video (innerFrench E188) in Explore. Startup seeding is off; tests call seed(). */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:seedvideo;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=true",
        "app.seed-videos-on-startup=false"
})
@AutoConfigureMockMvc
class SampleVideoSeederTest {

    static final String SAMPLE_ID = "AqxY-gvgiqM";
    private static final YouTubeStub STUB = SampleVideoStartupTest.stubWithSample();

    @DynamicPropertySource
    static void youtube(DynamicPropertyRegistry registry) {
        registry.add("app.youtube.base-url", STUB::baseUrl);
    }

    @AfterAll
    static void stop() {
        STUB.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    SampleVideoSeeder seeder;

    @Autowired
    SampleContentSeeder contentSeeder;

    @Autowired
    TextRepository texts;

    private JsonNode explore(TestApi api, String viewer, String kind) throws Exception {
        return api.get(viewer, "/api/library?kind=" + kind + "&size=50", 200);
    }

    @Test
    void seedsOnceAsPublicLibraryContentRetryingWhenYouTubeIsDown() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String viewer = api.signup();
        // The starter texts already exist (the library account owns 8 items, over the free limit of 5).
        assertThat(explore(api, viewer, "text").get("total").asLong()).isEqualTo(8);

        // YouTube unreachable: no exception, nothing seeded.
        STUB.setDown(true);
        assertThat(seeder.seed()).isZero();
        assertThat(explore(api, viewer, "video").get("total").asLong()).isZero();

        // Next run (YouTube back): seeded publicly, owned by the library account.
        STUB.setDown(false);
        assertThat(seeder.seed()).isEqualTo(1);
        JsonNode videos = explore(api, viewer, "video");
        assertThat(videos.get("total").asLong()).isEqualTo(1);
        JsonNode item = videos.get("items").get(0);
        assertThat(item.get("kind").asString()).isEqualTo("video");
        assertThat(item.get("language").asString()).isEqualTo("fr");
        assertThat(item.get("video").get("videoId").asString()).isEqualTo(SAMPLE_ID);
        assertThat(item.get("title").asString()).isEqualTo("N'apprenez pas le français en 2026");
        assertThat(item.get("owner").get("displayName").asString()).isEqualTo("Polygossa Library");
        assertThat(item.get("category").asString()).isEqualTo("learners"); // from videos.txt
        assertThat(item.get("stats").get("uniqueWords").asInt()).isPositive();
        JsonNode detail = api.get(viewer, "/api/texts/" + item.get("id").asLong(), 200).get("video");
        assertThat(detail.get("hasCues").asBoolean()).isTrue();
        assertThat(detail.get("timings").size()).isPositive();

        // Restart: no duplicate, YouTube not contacted; starter texts untouched.
        STUB.reset();
        assertThat(seeder.seed()).isZero();
        assertThat(STUB.requests()).isEmpty();
        assertThat(explore(api, viewer, "video").get("total").asLong()).isEqualTo(1);

        // A video seeded before categories existed is filed on the next start, still without contacting YouTube.
        texts.findById(item.get("id").asLong()).ifPresent(t -> {
            t.setCategory(null);
            texts.save(t);
        });
        assertThat(explore(api, viewer, "video").get("items").get(0).get("category").asString()).isEqualTo("other");
        assertThat(seeder.seed()).isZero();
        assertThat(explore(api, viewer, "video").get("items").get(0).get("category").asString()).isEqualTo("learners");
        assertThat(STUB.requests()).isEmpty();
        assertThat(explore(api, viewer, "text").get("total").asLong()).isEqualTo(8);
    }

    private Map<String, String> starterCategories(TestApi api, String viewer) throws Exception {
        Map<String, String> out = new HashMap<>();
        explore(api, viewer, "text").get("items").forEach(t -> out.put(t.get("language").asString(), t.get("category").asString()));
        return out;
    }

    @Test
    void starterTextsAreFiledUnderCategoriesAndRefiledWhenMissing() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String viewer = api.signup();
        Map<String, String> expected = Map.of("de", "stories", "es", "stories", "fr", "food", "it", "food",
                "ja", "daily-life", "ko", "daily-life", "pt", "travel", "zh", "daily-life");
        assertThat(starterCategories(api, viewer)).isEqualTo(expected);

        // A database from before categories existed: the starter texts have none, and seeding already happened.
        texts.findAll().forEach(t -> {
            t.setCategory(null);
            texts.save(t);
        });
        assertThat(starterCategories(api, viewer).values()).containsOnly("other");
        contentSeeder.run(null);
        assertThat(starterCategories(api, viewer)).isEqualTo(expected);
        assertThat(explore(api, viewer, "text").get("total").asLong()).isEqualTo(8); // no duplicates
    }

    @Test
    void doesNothingWhenSeedingIsDisabled() {
        var props = new AppProperties(null, null, null, null, null, null, List.of(), false, false);
        // No repositories or services are needed: a disabled seeder must return before touching any of them.
        assertThat(new SampleVideoSeeder(props, null, null, null, null, false).seed()).isZero();
    }
}
