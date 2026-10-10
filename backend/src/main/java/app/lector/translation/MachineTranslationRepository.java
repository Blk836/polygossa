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

    @Modifying
    @Transactional
    @Query(value = """
            insert into machine_translations (source_language, target_language, term, translation, created_at)
            values (:source, :target, :term, :translation, :createdAt)
            on conflict (source_language, target_language, term) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("source") String source, @Param("target") String target, @Param("term") String term,
                       @Param("translation") String translation, @Param("createdAt") Instant createdAt);

    @Modifying
    @Transactional
    @Query(value = """
            update machine_translations set translation = :translation, tried_in_context = true
            where source_language = :source and target_language = :target and term = :term
              and translation is null and not tried_in_context
            """, nativeQuery = true)
    int recordInContext(@Param("source") String source, @Param("target") String target, @Param("term") String term,
                        @Param("translation") String translation);
}
