package app.lector.translation;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface LookupCounterRepository extends JpaRepository<LookupCounter, Long> {

    interface Sums {
        LocalDate getDay();
        String getSourceLanguage();
        String getTargetLanguage();
        String getLayer();
        long getLookups();
        long getAiCalls();
        long getAiTokensIn();
        long getAiTokensOut();
        long getAiFailures();
    }

    @Modifying
    @Transactional
    @Query(value = """
            insert into lookup_counters (day, source_language, target_language, layer, lookups, ai_calls, ai_tokens_in,
                ai_tokens_out, ai_failures)
            values (:day, :source, :target, :layer, 1, :aiCalls, :aiTokensIn, :aiTokensOut, :aiFailures)
            on conflict (day, source_language, target_language, layer) do update set
                lookups = lookup_counters.lookups + 1,
                ai_calls = lookup_counters.ai_calls + excluded.ai_calls,
                ai_tokens_in = lookup_counters.ai_tokens_in + excluded.ai_tokens_in,
                ai_tokens_out = lookup_counters.ai_tokens_out + excluded.ai_tokens_out,
                ai_failures = lookup_counters.ai_failures + excluded.ai_failures
            """, nativeQuery = true)
    int addLookup(@Param("day") LocalDate day, @Param("source") String source, @Param("target") String target,
                  @Param("layer") String layer, @Param("aiCalls") long aiCalls, @Param("aiTokensIn") long aiTokensIn,
                  @Param("aiTokensOut") long aiTokensOut, @Param("aiFailures") long aiFailures);

    @Query(value = """
            select day, source_language as sourceLanguage, target_language as targetLanguage, layer, lookups,
                ai_calls as aiCalls, ai_tokens_in as aiTokensIn, ai_tokens_out as aiTokensOut,
                ai_failures as aiFailures
            from lookup_counters where day >= :first order by day
            """, nativeQuery = true)
    List<Sums> since(@Param("first") LocalDate first);
}
