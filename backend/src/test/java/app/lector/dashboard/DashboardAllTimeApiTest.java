package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ClockApiTest;
import app.lector.TestApi;
import app.lector.TestClock;
import app.lector.writing.MutableClock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@ClockApiTest
class DashboardAllTimeApiTest {

    static final MutableClock CLOCK = TestClock.CLOCK;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private int allTimeDays(Duration later) throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
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
