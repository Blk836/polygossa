package app.lector.recommend;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserInterestRepository extends JpaRepository<UserInterest, Long> {

    List<UserInterest> findByUserId(Long userId);

    @Modifying
    @Query("delete from UserInterest i where i.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
