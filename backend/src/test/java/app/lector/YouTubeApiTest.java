package app.lector;

import app.lector.video.YouTubeStub;
import app.lector.wordimport.LingqStub;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistrar;

/**
 * Like {@link ApiTest}, but the outside services are fakes: YouTube is {@link #STUB} and LingQ is {@link #LINGQ}, one
 * server each per test JVM that every class with this setup shares, along with one app on its own database. Tests
 * {@code reset()} the YouTube stub before adding the videos they need (LingQ accounts are per API key, so tests just
 * use their own key), and must not close either.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@SpringBootTest(properties = {
        "test.database=apiyoutube",
        "app.seed-samples=false",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        // Switches on the curator endpoints (bulk video import); nothing else here calls them.
        "app.curator-token=" + YouTubeApiTest.CURATOR_TOKEN
})
@AutoConfigureMockMvc
@Import(YouTubeApiTest.Config.class)
public @interface YouTubeApiTest {

    String CURATOR_TOKEN = "curator-secret";

    YouTubeStub STUB = Config.start();

    LingqStub LINGQ = Config.startLingq();

    @TestConfiguration
    class Config {
        static YouTubeStub start() {
            try {
                return new YouTubeStub();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }

        static LingqStub startLingq() {
            try {
                return new LingqStub();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }

        @Bean
        DynamicPropertyRegistrar youTubeStub() {
            return registry -> {
                registry.add("app.youtube.base-url", STUB::baseUrl);
                registry.add("app.lingq.base-url", LINGQ::baseUrl);
            };
        }
    }
}
