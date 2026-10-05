package app.lector.session;

import app.lector.token.Language;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReadingSessionRepository extends JpaRepository<ReadingSession, Long> {

    interface LanguageTotals {
        Language getLanguage();
        long getSessions();
        long getSeconds();
    }

    interface SessionTime {
        Instant getStartedAt();
        long getDurationSeconds();
    }

    @Query("select s.language as language, count(s) as sessions, coalesce(sum(s.durationSeconds), 0) as seconds "
            + "from ReadingSession s where s.user.id = :userId group by s.language")
    List<LanguageTotals> totalsByLanguage(@Param("userId") Long userId);

    @Query("select s.startedAt as startedAt, s.durationSeconds as durationSeconds from ReadingSession s "
            + "where s.user.id = :userId and s.startedAt >= :since")
    List<SessionTime> findSince(@Param("userId") Long userId, @Param("since") Instant since);

    @Query("select count(s) from ReadingSession s where s.user.id = :userId and s.language = :language")
    long countByUserAndLanguage(@Param("userId") Long userId, @Param("language") Language language);

    @Query("select coalesce(sum(s.durationSeconds), 0) from ReadingSession s where s.user.id = :userId "
            + "and s.language = :language")
    long secondsByUserAndLanguage(@Param("userId") Long userId, @Param("language") Language language);

    /** Ids of texts among {@code textIds} the user has finished. */
    @Query("select distinct s.text.id from ReadingSession s where s.user.id = :userId and s.completed = true "
            + "and s.text.id in :textIds")
    List<Long> completedTextIds(@Param("userId") Long userId, @Param("textIds") Collection<Long> textIds);

    /** Ids of texts among {@code textIds} the user has opened at least once. */
    @Query("select distinct s.text.id from ReadingSession s where s.user.id = :userId and s.text.id in :textIds")
    List<Long> openedTextIds(@Param("userId") Long userId, @Param("textIds") Collection<Long> textIds);

    @Query("select max(s.lastActiveAt) from ReadingSession s where s.user.id = :userId")
    Instant lastActive(@Param("userId") Long userId);

    @Modifying
    @Query("update ReadingSession s set s.text = null where s.text.id = :textId")
    void detachText(@Param("textId") Long textId);
}
