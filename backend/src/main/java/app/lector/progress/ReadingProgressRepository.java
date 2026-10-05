package app.lector.progress;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReadingProgressRepository extends JpaRepository<ReadingProgress, Long> {

    @Query("select p from ReadingProgress p where p.user.id = :userId and p.text.id = :textId")
    Optional<ReadingProgress> findOne(@Param("userId") Long userId, @Param("textId") Long textId);

    @Query("select p from ReadingProgress p where p.user.id = :userId and p.text.id in :textIds")
    List<ReadingProgress> findForTexts(@Param("userId") Long userId, @Param("textIds") Collection<Long> textIds);

    @Modifying
    @Query("delete from ReadingProgress p where p.text.id = :textId")
    void deleteByTextId(@Param("textId") Long textId);
}
