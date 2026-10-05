package app.lector.srs;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewLogRepository extends JpaRepository<ReviewLog, Long> {

    interface DayCount {
        LocalDate getDay();
        long getCount();
    }

    long countByUserIdAndReviewDate(Long userId, LocalDate reviewDate);

    @Query("select r.reviewDate as day, count(r) as count from ReviewLog r where r.user.id = :userId "
            + "and r.reviewDate >= :since group by r.reviewDate order by r.reviewDate desc")
    List<DayCount> countPerDaySince(@Param("userId") Long userId, @Param("since") LocalDate since);
}
