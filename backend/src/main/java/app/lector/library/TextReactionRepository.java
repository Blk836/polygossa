package app.lector.library;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TextReactionRepository extends JpaRepository<TextReaction, Long> {

    interface TextCount {
        Long getTextId();
        long getCount();
    }

    Optional<TextReaction> findByUserIdAndTextIdAndType(Long userId, Long textId, TextReaction.Type type);

    @Query("select r.text.id as textId, count(r) as count from TextReaction r "
            + "where r.text.id in :textIds and r.type = app.lector.library.TextReaction.Type.LIKE group by r.text.id")
    List<TextCount> likeCounts(@Param("textIds") Collection<Long> textIds);

    @Query("select r from TextReaction r where r.user.id = :userId and r.text.id in :textIds")
    List<TextReaction> findMine(@Param("userId") Long userId, @Param("textIds") Collection<Long> textIds);

    @Query("select r from TextReaction r join fetch r.text where r.user.id = :userId and r.type = :type "
            + "order by r.createdAt desc")
    List<TextReaction> findByUserAndType(@Param("userId") Long userId, @Param("type") TextReaction.Type type);

    @Modifying
    @Query("delete from TextReaction r where r.text.id = :textId")
    void deleteByTextId(@Param("textId") Long textId);
}
