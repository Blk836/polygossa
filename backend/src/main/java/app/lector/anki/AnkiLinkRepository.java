package app.lector.anki;

import app.lector.token.Language;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnkiLinkRepository extends JpaRepository<AnkiLink, Long> {

    @Query("select l from AnkiLink l join fetch l.entry where l.deck.id = :deck and l.entry.id in :entries")
    List<AnkiLink> findForEntries(@Param("deck") Long deck, @Param("entries") Collection<Long> entries);

    @Query("select l from AnkiLink l where l.userId = :user and l.entry.language = :language and l.entry.term = :term")
    List<AnkiLink> findForTerm(@Param("user") Long user, @Param("language") Language language,
                               @Param("term") String term);

    @Modifying
    @Query("delete from AnkiLink l where l.deck.id = :deck and (l.runId is null or l.runId <> :run)")
    void deleteNotSeenIn(@Param("deck") Long deck, @Param("run") Long run);
}
