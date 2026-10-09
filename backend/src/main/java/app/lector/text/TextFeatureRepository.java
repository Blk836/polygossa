package app.lector.text;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TextFeatureRepository extends JpaRepository<TextFeature, Long> {

    Optional<TextFeature> findByTextId(Long textId);

    List<TextFeature> findByTextIdIn(Collection<Long> textIds);

    interface Stamp {
        Long getTextId();

        long getVersion();
    }

    @Query("select f.textId as textId, f.version as version from TextFeature f where f.textId in :textIds")
    List<Stamp> findStamps(@Param("textIds") Collection<Long> textIds);

    @Query("select t.id from Text t where t.isPublic = true "
            + "and not exists (select f from TextFeature f where f.textId = t.id) order by t.id")
    List<Long> findPublicWithoutFeatures(Pageable page);

    @Query("select f.textId from TextFeature f where exists (select t from Text t where t.id = f.textId "
            + "and t.isPublic = true) and (f.tagModel is null or f.vector is null or f.embeddingModel <> :model) "
            + "and (f.nextAttemptAt is null or f.nextAttemptAt <= :now) order by f.textId")
    List<Long> findDue(@Param("model") String embeddingModel, @Param("now") Instant now, Pageable page);

    @Modifying
    @Query("delete from TextFeature f where f.textId = :textId")
    void deleteByTextId(@Param("textId") Long textId);
}
