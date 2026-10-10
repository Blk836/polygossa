package app.lector.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class AiAllowanceTest {

    @Test
    void usesTheLearnersTimezone() {
        assertThat(AiAllowance.zone("Asia/Tokyo")).isEqualTo(ZoneId.of("Asia/Tokyo"));
    }

    @Test
    void fallsBackToUtcForMissingOrUnknownTimezones() {
        assertThat(AiAllowance.zone(null)).isEqualTo(ZoneOffset.UTC);
        assertThat(AiAllowance.zone("  ")).isEqualTo(ZoneOffset.UTC);
        assertThat(AiAllowance.zone("Not/AZone")).isEqualTo(ZoneOffset.UTC);
    }
}
