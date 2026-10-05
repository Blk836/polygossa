package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.video.YouTubeStub;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/** Scenario: on a fresh start the sample video is seeded in the background, without blocking startup. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:seedstartup;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=true"
})
@AutoConfigureMockMvc
class SampleVideoStartupTest {

    private static final YouTubeStub STUB = stubWithSample();

    /** A YouTube stub that knows the seeded innerFrench episode, with two French caption lines. */
    static YouTubeStub stubWithSample() {
        try {
            YouTubeStub stub = new YouTubeStub();
            stub.add(SampleVideoSeederTest.SAMPLE_ID, YouTubeStub.Video.withCaptions(
                    "N'apprenez pas le français en 2026", 1551, "fr",
                    YouTubeStub.srv3("0|2000|Bonne année à toutes et à tous.", "2500|3000|Je suis ravi de vous retrouver.")));
            return stub;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

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

    @Test
    void seedsTheSampleVideoInTheBackgroundAfterStartup() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String viewer = api.signup();
        long total = 0;
        for (int i = 0; i < 100 && total == 0; i++) {
            total = api.get(viewer, "/api/library?kind=video&language=fr", 200).get("total").asLong();
            if (total == 0) {
                Thread.sleep(100);
            }
        }
        assertThat(total).isEqualTo(1);
    }
}
