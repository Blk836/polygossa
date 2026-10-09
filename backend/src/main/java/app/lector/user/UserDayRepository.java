package app.lector.user;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserDayRepository extends JpaRepository<UserDay, Long> {

    @Modifying
    @Query(value = "insert into user_days (user_id, day) values (:userId, :day) on conflict do nothing",
            nativeQuery = true)
    void record(@Param("userId") Long userId, @Param("day") LocalDate day);

    interface DayCount {
        LocalDate getDay();
        long getUsers();
    }

    @Query("select d.day as day, count(d) as users from UserDay d where d.day >= :first group by d.day")
    List<DayCount> perDaySince(@Param("first") LocalDate first);

    @Query("select count(distinct d.userId) from UserDay d where d.day >= :first")
    long distinctSince(@Param("first") LocalDate first);

    @Query("select max(d.day) from UserDay d where d.userId = :userId")
    LocalDate lastDay(@Param("userId") Long userId);
}
