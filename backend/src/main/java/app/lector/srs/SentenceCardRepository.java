package app.lector.srs;

import app.lector.token.Language;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SentenceCardRepository extends JpaRepository<SentenceCard, Long> {

    @Query("select s from SentenceCard s where s.user.id = :userId and (:language is null or s.language = :language) "
            + "order by s.createdAt desc")
    List<SentenceCard> findForUser(@Param("userId") Long userId, @Param("language") Language language);

    @Query("select s from SentenceCard s where s.user.id = :userId and (:language is null or s.language = :language) "
            + "and s.srs.dueAt <= :now order by s.srs.dueAt asc")
    List<SentenceCard> findDue(@Param("userId") Long userId, @Param("language") Language language,
                               @Param("now") Instant now, Pageable pageable);

    @Query("select count(s) from SentenceCard s where s.user.id = :userId "
            + "and (:language is null or s.language = :language) and s.srs.dueAt <= :now")
    long countDue(@Param("userId") Long userId, @Param("language") Language language, @Param("now") Instant now);

    @Modifying
    @Query("update SentenceCard s set s.sourceText = null where s.sourceText.id = :textId")
    void detachText(@Param("textId") Long textId);
}
