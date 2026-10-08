package app.lector.vocab;

import app.lector.token.Language;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VocabularyRepository extends JpaRepository<VocabularyEntry, Long> {

    interface LanguageStatusCount {
        Language getLanguage();
        WordStatus getStatus();
        long getCount();
    }

    Optional<VocabularyEntry> findByUserIdAndLanguageAndTerm(Long userId, Language language, String term);

    List<VocabularyEntry> findByUserIdAndLanguageAndTermIn(Long userId, Language language, java.util.Collection<String> terms);

    @Query("select new app.lector.vocab.TermStatus(v.term, v.status, v.kind) from VocabularyEntry v "
            + "where v.user.id = :userId and v.language = :language")
    List<TermStatus> findTermStatuses(@Param("userId") Long userId, @Param("language") Language language);

    /** {@code q} must be a lower-cased LIKE pattern or null. */
    @Query("""
            select v from VocabularyEntry v
            where v.user.id = :userId
              and (:language is null or v.language = :language)
              and (:status is null or v.status = :status)
              and (:kind is null or v.kind = :kind)
              and (:q is null or v.term like :q or lower(v.definition) like :q or lower(v.note) like :q)
              and (:tag is null or v.tags like :tag)
            """)
    Page<VocabularyEntry> search(@Param("userId") Long userId, @Param("language") Language language,
                                 @Param("status") WordStatus status, @Param("kind") EntryKind kind,
                                 @Param("q") String q, @Param("tag") String tag, Pageable pageable);

    @Query("select v.tags from VocabularyEntry v where v.user.id = :userId "
            + "and (:language is null or v.language = :language) and v.tags is not null")
    List<String> findTagColumns(@Param("userId") Long userId, @Param("language") Language language);

    @Query("select v from VocabularyEntry v where v.user.id = :userId "
            + "and (:language is null or v.language = :language) order by v.language, v.term")
    List<VocabularyEntry> findForExport(@Param("userId") Long userId, @Param("language") Language language);

    long countByUserIdAndStatus(Long userId, WordStatus status);

    @Query("select v.language as language, v.status as status, count(v) as count from VocabularyEntry v "
            + "where v.user.id = :userId group by v.language, v.status")
    List<LanguageStatusCount> countByLanguageAndStatus(@Param("userId") Long userId);

    @Query("""
            select v from VocabularyEntry v
            where v.user.id = :userId and v.status = app.lector.vocab.WordStatus.LEARNING
              and (:language is null or v.language = :language) and v.srs.dueAt <= :now
            order by v.srs.dueAt asc
            """)
    List<VocabularyEntry> findDue(@Param("userId") Long userId, @Param("language") Language language,
                                  @Param("now") Instant now, Pageable pageable);

    @Query("""
            select count(v) from VocabularyEntry v
            where v.user.id = :userId and v.status = app.lector.vocab.WordStatus.LEARNING
              and (:language is null or v.language = :language) and v.srs.dueAt <= :now
            """)
    long countDue(@Param("userId") Long userId, @Param("language") Language language, @Param("now") Instant now);

    /** When each of the user's words was saved, for those saved since {@code since}. */
    @Query("select v.createdAt from VocabularyEntry v where v.user.id = :userId and v.createdAt >= :since")
    List<Instant> findCreatedSince(@Param("userId") Long userId, @Param("since") Instant since);

    /** When each currently known word was marked known, for those marked since {@code since}. */
    @Query("select v.knownAt from VocabularyEntry v where v.user.id = :userId "
            + "and v.status = app.lector.vocab.WordStatus.KNOWN and v.knownAt >= :since")
    List<Instant> findKnownSince(@Param("userId") Long userId, @Param("since") Instant since);

    @Query("select v.knownAt from VocabularyEntry v where v.user.id = :userId and v.language = :language "
            + "and v.status = app.lector.vocab.WordStatus.KNOWN and v.knownAt is not null")
    List<Instant> findKnownTimestamps(@Param("userId") Long userId, @Param("language") Language language);

    @Query("select count(v) from VocabularyEntry v where v.user.id = :userId and v.language = :language "
            + "and v.createdAt >= :since")
    long countCreatedSince(@Param("userId") Long userId, @Param("language") Language language,
                           @Param("since") Instant since);

    long countByUserIdAndLanguageAndStatus(Long userId, Language language, WordStatus status);

    /**
     * The meanings learners saved for a word in one native language that at least {@code minLearners} of them share
     * (case aside), most shared first, ties alphabetically. One entry per learner and term, so entries count learners.
     */
    @Query("""
            select min(v.meaning) from VocabularyEntry v
            where v.language = :language and v.term = :term and v.meaningLanguage = :meaningLanguage
              and v.meaning is not null
            group by lower(v.meaning)
            having count(v) >= :minLearners
            order by count(v) desc, lower(v.meaning) asc
            """)
    List<String> findCommunityMeanings(@Param("language") Language language, @Param("term") String term,
                                       @Param("meaningLanguage") app.lector.token.NativeLanguage meaningLanguage,
                                       @Param("minLearners") long minLearners, Pageable pageable);

    @Modifying
    @Query("update VocabularyEntry v set v.sourceText = null where v.sourceText.id = :textId")
    void detachText(@Param("textId") Long textId);

    /** Words each user came to know since a moment. */
    interface UserCount {
        Long getUserId();

        long getCount();
    }

    @Query("select v.user.id as userId, count(v) as count from VocabularyEntry v where v.knownAt >= :since "
            + "and v.status = app.lector.vocab.WordStatus.KNOWN group by v.user.id")
    List<UserCount> knownSinceByUser(@Param("since") java.time.Instant since);
}
