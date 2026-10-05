package app.lector.writing;

import app.lector.token.Language;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WritingTestRepository extends JpaRepository<WritingTest, Long> {

    /** A test still open for writing (not handed in, deadline plus grace not passed). */
    Optional<WritingTest> findFirstByUserIdAndLanguageAndSubmittedAtIsNullAndDeadlineAfterOrderByStartedAtDesc(
            Long userId, Language language, Instant closesAfter);

    List<WritingTest> findTop20ByUserIdAndLanguageOrderByStartedAtDescIdDesc(Long userId, Language language);

    List<WritingTest> findTop20ByUserIdAndLevelOrderByStartedAtDesc(Long userId, String level);

    @Query("select t.submittedAt from WritingTest t where t.user.id = :userId and t.submittedAt >= :since")
    List<Instant> findSubmittedSince(@Param("userId") Long userId, @Param("since") Instant since);
}
