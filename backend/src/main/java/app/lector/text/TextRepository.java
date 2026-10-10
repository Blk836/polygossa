package app.lector.text;

import app.lector.token.Language;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TextRepository extends JpaRepository<Text, Long> {

    List<Text> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    long countByOwnerId(Long ownerId);

    boolean existsByOwnerIdAndVideoId(Long ownerId, String videoId);

    List<Text> findByOwnerIdAndVideoId(Long ownerId, String videoId);

    @Query("select t from Text t where t.videoId = :videoId and t.language = :language "
            + "order by t.isPublic desc, t.createdAt desc, t.id desc")
    List<Text> findCopiesOfVideo(@Param("videoId") String videoId, @Param("language") Language language);

    List<Text> findByOwnerIdAndLanguageAndTitle(Long ownerId, Language language, String title);

    @Query("select t from Text t where t.body.content like '%[%' or t.body.content like '%［%' or t.body.content like '%【%'")
    List<Text> findWithSquareBrackets();

    @Query("select t.id from Text t where t.language in :languages and (t.body.tokensJson like '%''\",\"word\":true%'"
            + " or t.body.tokensJson like '%’\",\"word\":true%')")
    List<Long> findIdsWithSplitElisions(@Param("languages") Collection<Language> languages);

    @Query("""
            select t from Text t
            where t.isPublic = true
              and t.language in :languages
              and (:level is null or t.cefrLevel = :level)
              and (:q is null or lower(t.title) like :q)
              and (:kind is null or (:kind = 'video' and t.videoId is not null)
                   or (:kind = 'text' and t.videoId is null))
              and (:category is null or t.category = :category
                   or (:category = app.lector.text.Category.OTHER and t.category is null))
              and (:topic is null or exists (select f from TextFeature f where f.textId = t.id
                   and f.topics like :topic))
            order by t.createdAt desc
            """)
    Page<Text> searchPublicNewest(@Param("languages") Collection<Language> languages, @Param("level") String level,
                                  @Param("q") String q, @Param("kind") String kind,
                                  @Param("category") Category category,
                                  @Param("topic") String topic,
                                  Pageable pageable);

    interface ShelfEntry {
        Long getId();

        Category getCategory();
    }

    @Query("""
            select t.id as id, t.category as category from Text t
            where t.isPublic = true
              and t.language in :languages
              and (:level is null or t.cefrLevel = :level)
              and (:kind is null or (:kind = 'video' and t.videoId is not null)
                   or (:kind = 'text' and t.videoId is null))
            order by t.createdAt desc
            """)
    List<ShelfEntry> findPublicShelfEntries(@Param("languages") Collection<Language> languages, @Param("level") String level,
                                            @Param("kind") String kind);

    @Query("select t from Text t where t.isPublic = true and t.language in :languages "
            + "and t.owner.id <> :userId")
    List<Text> findPublicCandidates(@Param("languages") Collection<Language> languages, @Param("userId") Long userId);

    @Query("""
            select t from Text t
            where t.isPublic = true
              and t.language in :languages
              and (:level is null or t.cefrLevel = :level)
              and (:q is null or lower(t.title) like :q)
              and (:kind is null or (:kind = 'video' and t.videoId is not null)
                   or (:kind = 'text' and t.videoId is null))
              and (:category is null or t.category = :category
                   or (:category = app.lector.text.Category.OTHER and t.category is null))
              and (:topic is null or exists (select f from TextFeature f where f.textId = t.id
                   and f.topics like :topic))
            order by (select count(r) from TextReaction r where r.text = t
                      and r.type = app.lector.library.TextReaction.Type.LIKE) desc, t.createdAt desc
            """)
    Page<Text> searchPublicPopular(@Param("languages") Collection<Language> languages, @Param("level") String level,
                                   @Param("q") String q, @Param("kind") String kind,
                                  @Param("category") Category category,
                                   @Param("topic") String topic,
                                   Pageable pageable);
}
