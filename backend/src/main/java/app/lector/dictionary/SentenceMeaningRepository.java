package app.lector.dictionary;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface SentenceMeaningRepository extends JpaRepository<SentenceMeaning, Long> {

    Optional<SentenceMeaning> findBySourceLanguageAndTargetLanguageAndTermAndContextHash(
            Language sourceLanguage, NativeLanguage targetLanguage, String term, String contextHash);

    long countBySourceLanguageAndTargetLanguageAndTerm(Language sourceLanguage, NativeLanguage targetLanguage,
                                                       String term);

    @Modifying
    @Transactional
    @Query(value = """
            insert into sentence_meanings (source_language, target_language, term, context_hash, meaning, created_at)
            values (:source, :target, :term, :contextHash, :meaning, :createdAt)
            on conflict (source_language, target_language, term, context_hash) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("source") String source, @Param("target") String target, @Param("term") String term,
                       @Param("contextHash") String contextHash, @Param("meaning") String meaning,
                       @Param("createdAt") Instant createdAt);
}
