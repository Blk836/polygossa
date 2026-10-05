package app.lector.ai;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WritingSubmissionRepository extends JpaRepository<WritingSubmission, Long> {

    List<WritingSubmission> findByUserIdAndTextIdOrderByCreatedAtDesc(Long userId, Long textId);

    @Modifying
    @Query("update WritingSubmission w set w.text = null where w.text.id = :textId")
    void detachText(@Param("textId") Long textId);
}
