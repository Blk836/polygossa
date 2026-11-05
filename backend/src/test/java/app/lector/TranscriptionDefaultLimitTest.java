package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.video.TranscriptionLimits;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

@ApiTest
class TranscriptionDefaultLimitTest {

    @Autowired
    TranscriptionLimits limits;

    @Test
    void aSeventyMinuteVideoIsWithinTheDefaultLimit() {
        assertThat(limits.tooLong(70 * 60)).isEmpty();
    }

    @Test
    void aVideoJustOverSeventyMinutesIsTooLong() {
        assertThat(limits.tooLong(71 * 60)).contains("71 min is over the 70-minute limit");
    }

    @Test
    void whispersFileLimitStillApplies() {
        assertThat(limits.tooBig(26_214_401L)).isPresent();
        assertThat(limits.tooBig(26_214_400L)).isEmpty();
    }
}
