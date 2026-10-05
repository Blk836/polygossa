package app.lector.text;

import app.lector.token.Language;
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

    List<Text> findByOwnerIdAndLanguageAndTitle(Long ownerId, Language language, String title);

    /** Texts with an opening square bracket of any width: the ones that may hold caption annotations. */
    @Query("select t from Text t where t.content like '%[%' or t.content like '%［%' or t.content like '%【%'")
    List<Text> findWithSquareBrackets();

    /**
     * Public community content, newest first. {@code q} must be a lower-cased LIKE pattern or null; {@code kind} is
     * "text", "video" or null for both; {@code category} OTHER also matches uncategorised rows.
     */
    @Query("""
            select t from Text t
            where t.isPublic = true
              and (:language is null or t.language = :language)
              and (:level is null or t.cefrLevel = :level)
              and (:q is null or lower(t.title) like :q)
              and (:kind is null or (:kind = 'video' and t.videoId is not null)
                   or (:kind = 'text' and t.videoId is null))
              and (:category is null or t.category = :category
                   or (:category = app.lector.text.Category.OTHER and t.category is null))
            order by t.createdAt desc
            """)
    Page<Text> searchPublicNewest(@Param("language") Language language, @Param("level") String level,
                                  @Param("q") String q, @Param("kind") String kind,
                                  @Param("category") Category category,
                                  Pageable pageable);

    /** Public community content, most liked first. */
    @Query("""
            select t from Text t
            where t.isPublic = true
              and (:language is null or t.language = :language)
              and (:level is null or t.cefrLevel = :level)
              and (:q is null or lower(t.title) like :q)
              and (:kind is null or (:kind = 'video' and t.videoId is not null)
                   or (:kind = 'text' and t.videoId is null))
              and (:category is null or t.category = :category
                   or (:category = app.lector.text.Category.OTHER and t.category is null))
            order by (select count(r) from TextReaction r where r.text = t
                      and r.type = app.lector.library.TextReaction.Type.LIKE) desc, t.createdAt desc
            """)
    Page<Text> searchPublicPopular(@Param("language") Language language, @Param("level") String level,
                                   @Param("q") String q, @Param("kind") String kind,
                                  @Param("category") Category category,
                                   Pageable pageable);
}
