package app.lector.ai;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface AiUsageRepository extends JpaRepository<AiUsage, Long> {

    Optional<AiUsage> findByUserIdAndDay(Long userId, LocalDate day);

    /** Adds one call to an existing row; returns how many rows changed (0 when the day has no row yet). */
    @Modifying
    @Transactional
    @Query("update AiUsage u set u.calls = u.calls + 1 where u.userId = :userId and u.day = :day")
    int increment(@Param("userId") Long userId, @Param("day") LocalDate day);
}
