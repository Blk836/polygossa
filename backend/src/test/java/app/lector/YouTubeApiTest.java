package app.lector;

import app.lector.video.YouTubeStub;
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
 * Like {@link ApiTest}, but YouTube is {@link #STUB}: one fake server per test JVM that every class with this setup
 * shares, along with one app on its own database. Tests {@code reset()} the stub before adding the videos they need,
 * and must not close it.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:apiyoutube;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
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

    @TestConfiguration
    class Config {
        static YouTubeStub start() {
            try {
                return new YouTubeStub();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }

        @Bean
        DynamicPropertyRegistrar youTubeStub() {
            return registry -> registry.add("app.youtube.base-url", STUB::baseUrl);
        }
    }
}
