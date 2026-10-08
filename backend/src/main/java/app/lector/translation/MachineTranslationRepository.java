package app.lector.translation;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface MachineTranslationRepository extends JpaRepository<MachineTranslation, Long> {

    Optional<MachineTranslation> findBySourceLanguageAndTargetLanguageAndTerm(Language sourceLanguage,
                                                                              NativeLanguage targetLanguage, String term);

    long countBySourceLanguageAndTargetLanguageAndTerm(Language sourceLanguage, NativeLanguage targetLanguage,
                                                       String term);

    /**
     * Stores an answer unless one is already there (two lookups of a new word at once keep the first). The languages
     * are enum names ("DE", "ES").
     */
    @Modifying
    @Transactional
    @Query(value = """
            insert into machine_translations (source_language, target_language, term, translation, created_at)
            values (:source, :target, :term, :translation, :createdAt)
            on conflict (source_language, target_language, term) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("source") String source, @Param("target") String target, @Param("term") String term,
                       @Param("translation") String translation, @Param("createdAt") Instant createdAt);
}
