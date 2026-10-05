package app.lector.ai;

import app.lector.common.ApiException;
import app.lector.config.AppProperties;
import app.lector.user.User;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Each user's daily allowance of AI calls, counted per day in their own timezone. Only calls that succeed are
 * counted, and calls over the allowance never reach the AI service.
 */
@Service
public class AiAllowance {

    static final String LIMIT_MESSAGE = "You've used today's AI allowance; it resets at midnight";

    private final AiUsageRepository usage;
    private final Clock clock;
    private final int dailyLimit;

    public AiAllowance(AiUsageRepository usage, Clock clock, AppProperties props) {
        this.usage = usage;
        this.clock = clock;
        this.dailyLimit = props.openai().dailyLimit();
    }

    /** Runs an AI call for the user if they have allowance left, and counts it once it has succeeded. */
    public <T> T call(User user, Supplier<T> aiCall) {
        LocalDate day = today(user);
        int used = usage.findByUserIdAndDay(user.getId(), day).map(AiUsage::getCalls).orElse(0);
        if (used >= dailyLimit) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "ai_limit", LIMIT_MESSAGE);
        }
        T result = aiCall.get();
        record(user.getId(), day);
        return result;
    }

    private void record(Long userId, LocalDate day) {
        if (usage.increment(userId, day) > 0) {
            return;
        }
        try {
            usage.saveAndFlush(new AiUsage(userId, day, 1));
        } catch (DataIntegrityViolationException e) {
            usage.increment(userId, day); // another request created the day's row first
        }
    }

    LocalDate today(User user) {
        return clock.instant().atZone(zone(user.getTimezone())).toLocalDate();
    }

    static ZoneId zone(String timezone) {
        try {
            return timezone == null || timezone.isBlank() ? ZoneOffset.UTC : ZoneId.of(timezone);
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }
}
