package app.lector;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;

/**
 * Like {@link ApiTest}, but the app's clock is {@link TestClock#CLOCK}, which tests move to cross days and deadlines.
 * Every class with this setup shares one app (on its own database, so the fixed clock never meets data written
 * against the real one); the clock goes back to its start before each test, so no test sees time another one moved.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:apiclock;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
@Import(TestClock.Config.class)
@ExtendWith(TestClock.class)
public @interface ClockApiTest {
}
