package app.lector.recommend;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecommendationEventRepository extends JpaRepository<RecommendationEvent, Long> {

    /** How often one learner was shown and opened each text. */
    interface TextTally {
        Long getTextId();

        long getImpressions();

        long getOpens();
    }

    @Query("select e.textId as textId, "
            + "sum(case when e.type = app.lector.recommend.RecommendationEvent.Type.IMPRESSION then 1 else 0 end) "
            + "as impressions, "
            + "sum(case when e.type = app.lector.recommend.RecommendationEvent.Type.OPEN then 1 else 0 end) as opens "
            + "from RecommendationEvent e where e.userId = :userId group by e.textId")
    List<TextTally> tallies(@Param("userId") Long userId);

    /** Events per shelf and type since a moment. */
    interface ShelfCount {
        String getShelf();

        RecommendationEvent.Type getType();

        long getCount();
    }

    @Query("select e.shelf as shelf, e.type as type, count(e) as count from RecommendationEvent e "
            + "where e.createdAt >= :since group by e.shelf, e.type")
    List<ShelfCount> countByShelf(@Param("since") Instant since);

    /** A learner opening a text from a shelf (once per shelf, learner and text). */
    interface Opened {
        String getShelf();

        Long getUserId();

        Long getTextId();
    }

    @Query("select distinct e.shelf as shelf, e.userId as userId, e.textId as textId from RecommendationEvent e "
            + "where e.type = app.lector.recommend.RecommendationEvent.Type.OPEN and e.createdAt >= :since")
    List<Opened> opened(@Param("since") Instant since);

    interface UserCount {
        Long getUserId();

        long getCount();
    }

    @Query("select e.userId as userId, count(e) as count from RecommendationEvent e "
            + "where e.type = app.lector.recommend.RecommendationEvent.Type.OPEN and e.createdAt >= :since "
            + "group by e.userId")
    List<UserCount> opensByUser(@Param("since") Instant since);

    @Modifying
    @Query("delete from RecommendationEvent e where e.textId = :textId")
    void deleteByTextId(@Param("textId") Long textId);
}
