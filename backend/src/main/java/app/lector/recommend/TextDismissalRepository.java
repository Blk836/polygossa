package app.lector.recommend;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TextDismissalRepository extends JpaRepository<TextDismissal, Long> {

    List<TextDismissal> findByUserId(Long userId);

    Optional<TextDismissal> findByUserIdAndTextId(Long userId, Long textId);

    @Modifying
    @Query("delete from TextDismissal d where d.textId = :textId")
    void deleteByTextId(@Param("textId") Long textId);
}
