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

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@SpringBootTest(properties = {
        "test.database=apiclock",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
@Import(TestClock.Config.class)
@ExtendWith(TestClock.class)
public @interface ClockApiTest {
}
