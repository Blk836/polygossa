package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
import app.lector.writing.MutableClock;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/** "All time" on the Progress page runs from the day the learner signed up, as days pass after it. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:dashalltime;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
class DashboardAllTimeApiTest {

    static final MutableClock CLOCK = new MutableClock();

    @TestConfiguration
    static class Clocks {
        @Bean
        @Primary
        Clock testClock() {
            return CLOCK;
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    /** Days in "all time" for a learner who signed up just now, seen {@code later} afterwards. */
    private int allTimeDays(Duration later) throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup(); // accounts are stamped with the real time
        CLOCK.set(Instant.now().plus(later));
        return api.get(token, "/api/dashboard?period=all", 200).get("period").get("days").asInt();
    }

    @Test
    void threeDaysAfterSigningUpAllTimeIsFourDays() throws Exception {
        assertThat(allTimeDays(Duration.ofDays(3))).isEqualTo(4);
    }

    @Test
    void aClockBehindTheSignupStillGivesOneDay() throws Exception {
        assertThat(allTimeDays(Duration.ofDays(-2))).isEqualTo(1);
    }
}
