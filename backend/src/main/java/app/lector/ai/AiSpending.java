package app.lector.ai;

import app.lector.config.AppProperties;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AiSpending {

    private static final List<String> SYSTEM_JOBS = Arrays.stream(AiJob.values()).filter(AiJob::system)
            .map(AiJob::name).toList();

    private final AiJobUsageRepository usage;
    private final Clock clock;
    private final long systemDailyTokens;

    public AiSpending(AiJobUsageRepository usage, Clock clock, AppProperties props) {
        this.usage = usage;
        this.clock = clock;
        this.systemDailyTokens = props.openai().systemDailyTokens();
    }

    public LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    public void succeeded(AiJob job, long tokensIn, long tokensOut) {
        usage.add(today(), job.name(), 0, tokensIn, tokensOut);
    }

    public void failed(AiJob job, long tokensIn, long tokensOut) {
        usage.add(today(), job.name(), 1, tokensIn, tokensOut);
    }

    public long systemTokensToday() {
        return usage.tokens(today(), SYSTEM_JOBS);
    }

    public long systemDailyTokens() {
        return systemDailyTokens;
    }

    public boolean systemBudgetLeft() {
        return systemTokensToday() < systemDailyTokens;
    }
}
