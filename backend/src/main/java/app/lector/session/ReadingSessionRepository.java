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
        long getListened();
    }

    @Query("select s.language as language, count(s) as sessions, coalesce(sum(s.durationSeconds), 0) as seconds, "
            + "coalesce(sum(s.listenedSeconds), 0) as listened "
            + "from ReadingSession s where s.user.id = :userId group by s.language")
    List<LanguageTotals> totalsByLanguage(@Param("userId") Long userId);

    @Query("select new app.lector.session.SessionTime(s.startedAt, s.durationSeconds, coalesce(s.listenedSeconds, 0)) "
            + "from ReadingSession s "
            + "where s.user.id = :userId and s.startedAt >= :since")
    List<SessionTime> findSince(@Param("userId") Long userId, @Param("since") Instant since);

    @Query("select count(s) from ReadingSession s where s.user.id = :userId and s.language = :language")
    long countByUserAndLanguage(@Param("userId") Long userId, @Param("language") Language language);

    @Query("select coalesce(sum(s.durationSeconds), 0) from ReadingSession s where s.user.id = :userId "
            + "and s.language = :language")
    long secondsByUserAndLanguage(@Param("userId") Long userId, @Param("language") Language language);

    @Query("select coalesce(sum(s.durationSeconds), 0) from ReadingSession s join s.text t where s.user.id = :userId "
            + "and s.language = :language and (t.videoId is not null or t.audioFile is not null or t.audioUrl is not null)")
    long listeningSeconds(@Param("userId") Long userId, @Param("language") Language language);

    @Query("select distinct s.text.id from ReadingSession s where s.user.id = :userId and s.completed = true "
            + "and s.text.id in :textIds")
    List<Long> completedTextIds(@Param("userId") Long userId, @Param("textIds") Collection<Long> textIds);

    @Query("select distinct s.text.id from ReadingSession s where s.user.id = :userId and s.text.id in :textIds")
    List<Long> openedTextIds(@Param("userId") Long userId, @Param("textIds") Collection<Long> textIds);

    interface TextTime {
        Long getTextId();
        long getSeconds();
        Instant getLastActive();
    }

    @Query("select s.text.id as textId, coalesce(sum(s.durationSeconds), 0) as seconds, max(s.lastActiveAt) as lastActive "
            + "from ReadingSession s where s.user.id = :userId and s.text is not null group by s.text.id")
    List<TextTime> timeByText(@Param("userId") Long userId);

    @Query("select distinct s.user.id from ReadingSession s where s.lastActiveAt >= :since")
    List<Long> activeUserIds(@Param("since") Instant since);

    @Query("select max(s.lastActiveAt) from ReadingSession s where s.user.id = :userId")
    Instant lastActive(@Param("userId") Long userId);

    @Modifying
    @Query("update ReadingSession s set s.text = null where s.text.id = :textId")
    void detachText(@Param("textId") Long textId);
}
