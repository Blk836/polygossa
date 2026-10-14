package app.lector.ai;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public interface AiJobUsageRepository extends JpaRepository<AiJobUsage, Long> {

    interface Sums {
        String getJob();
        long getCalls();
        long getFailures();
        long getTokensIn();
        long getTokensOut();
    }

    @Modifying
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Query(value = """
            insert into ai_job_usage (day, job, calls, failures, tokens_in, tokens_out)
            values (:day, :job, 1, :failures, :tokensIn, :tokensOut)
            on conflict (day, job) do update set
                calls = ai_job_usage.calls + 1,
                failures = ai_job_usage.failures + excluded.failures,
                tokens_in = ai_job_usage.tokens_in + excluded.tokens_in,
                tokens_out = ai_job_usage.tokens_out + excluded.tokens_out
            """, nativeQuery = true)
    int add(@Param("day") LocalDate day, @Param("job") String job, @Param("failures") long failures,
            @Param("tokensIn") long tokensIn, @Param("tokensOut") long tokensOut);

    @Query(value = """
            select cast(coalesce(sum(tokens_in + tokens_out), 0) as bigint) from ai_job_usage
            where day = :day and job in (:jobs)""", nativeQuery = true)
    long tokens(@Param("day") LocalDate day, @Param("jobs") Collection<String> jobs);

    @Query(value = """
            select job, cast(sum(calls) as bigint) as calls, cast(sum(failures) as bigint) as failures,
                cast(sum(tokens_in) as bigint) as tokensIn,
                cast(sum(tokens_out) as bigint) as tokensOut
            from ai_job_usage where day >= :first group by job""", nativeQuery = true)
    List<Sums> since(@Param("first") LocalDate first);
}
