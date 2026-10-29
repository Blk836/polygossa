package app.lector.translation;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.stereotype.Service;

@Service
public class LookupCounters {

    private final LookupCounterRepository counters;
    private final Clock clock;

    public LookupCounters(LookupCounterRepository counters, Clock clock) {
        this.counters = counters;
        this.clock = clock;
    }

    public void count(Language source, NativeLanguage target, LookupLayer layer, LookupTally t) {
        counters.addLookup(LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC), source.name(), target.name(),
                layer.name(), t.aiCalls(), t.aiTokensIn(), t.aiTokensOut(), t.aiFailures());
    }
}
