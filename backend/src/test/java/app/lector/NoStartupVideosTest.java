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

/** Scenario: startup imports no videos (only the starter texts), and YouTube is never contacted. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:nostartupvideos;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=true"
})
@AutoConfigureMockMvc
class NoStartupVideosTest {

    /** Knows the video the old startup list imported, so an import would succeed if anything still tried. */
    private static final YouTubeStub STUB = stubWithFormerSample();

    private static YouTubeStub stubWithFormerSample() {
        try {
            YouTubeStub stub = new YouTubeStub();
            stub.add("AqxY-gvgiqM", YouTubeStub.Video.withCaptions("N'apprenez pas le français en 2026", 1551, "fr",
                    YouTubeStub.srv3("0|2000|Bonne année à toutes et à tous.")));
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
    void startupSeedsTheStarterTextsButNoVideos() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String viewer = api.signup();
        assertThat(api.get(viewer, "/api/library?kind=text&size=50", 200).get("total").asLong()).isEqualTo(8);

        // Background work after startup gets time to happen before we check it didn't.
        long videos = 0;
        for (int i = 0; i < 30 && videos == 0; i++) {
            Thread.sleep(100);
            videos = api.get(viewer, "/api/library?kind=video&size=50", 200).get("total").asLong();
        }
        assertThat(videos).isZero();
        assertThat(STUB.requests()).isEmpty();
    }
}
