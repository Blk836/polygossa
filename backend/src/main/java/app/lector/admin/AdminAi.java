package app.lector.admin;

import app.lector.ai.AiJob;
import app.lector.ai.AiJobUsageRepository;
import app.lector.ai.AiSpending;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAi {

    public record Row(String job, boolean system, long calls, long failures, long tokensIn, long tokensOut,
                      double cost) {}

    public record Today(LocalDate day, long systemTokens, long ceiling) {}

    public record Report(int days, LookupPrices prices, Today today, List<Row> jobs, Row total) {}

    private final AiJobUsageRepository usage;
    private final AiSpending spending;
    private final LookupPrices prices;

    public AdminAi(AiJobUsageRepository usage, AiSpending spending, LookupPrices prices) {
        this.usage = usage;
        this.spending = spending;
        this.prices = prices;
    }

    @Transactional(readOnly = true)
    public Report report(int days) {
        LocalDate today = spending.today();
        List<Row> jobs = usage.since(today.minusDays(days - 1L)).stream()
                .map(s -> new Row(s.getJob(), AiJob.valueOf(s.getJob()).system(), s.getCalls(), s.getFailures(),
                        s.getTokensIn(), s.getTokensOut(), prices.cost(AiJob.valueOf(s.getJob()), s.getTokensIn(), s.getTokensOut())))
                .sorted(Comparator.comparingDouble(Row::cost).reversed().thenComparing(Row::job))
                .toList();
        Row total = new Row(null, false, jobs.stream().mapToLong(Row::calls).sum(),
                jobs.stream().mapToLong(Row::failures).sum(), jobs.stream().mapToLong(Row::tokensIn).sum(),
                jobs.stream().mapToLong(Row::tokensOut).sum(), jobs.stream().mapToDouble(Row::cost).sum());
        return new Report(days, prices, new Today(today, spending.systemTokensToday(), spending.systemDailyTokens()),
                jobs, total);
    }
}
