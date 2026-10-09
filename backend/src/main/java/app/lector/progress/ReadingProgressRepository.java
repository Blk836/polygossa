package app.lector.progress;

import app.lector.token.Language;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReadingProgressRepository extends JpaRepository<ReadingProgress, Long> {

    /** A finished text's level and whether it is listened to (a video or a text with audio). */
    interface FinishedText {
        String getLevel();
        String getVideoId();
        String getAudioFile();
        String getAudioUrl();
    }

    @Query("select t.cefrLevel as level, t.videoId as videoId, t.audioFile as audioFile, t.audioUrl as audioUrl "
            + "from ReadingProgress p join p.text t where p.user.id = :userId and t.language = :language "
            + "and p.completed = true and t.cefrLevel is not null")
    List<FinishedText> findFinished(@Param("userId") Long userId, @Param("language") Language language);

    @Query("select p from ReadingProgress p where p.user.id = :userId and p.text.id = :textId")
    Optional<ReadingProgress> findOne(@Param("userId") Long userId, @Param("textId") Long textId);

    /** All of a user's progress, with the texts (card fields only). */
    @Query("select p from ReadingProgress p join fetch p.text where p.user.id = :userId")
    List<ReadingProgress> findAllForUser(@Param("userId") Long userId);

    /** Progress of these users on these texts (for recommendation metrics). */
    @Query("select p from ReadingProgress p where p.user.id in :userIds and p.text.id in :textIds")
    List<ReadingProgress> findForUsersAndTexts(@Param("userIds") Collection<Long> userIds,
                                               @Param("textIds") Collection<Long> textIds);

    @Query("select p from ReadingProgress p where p.user.id = :userId and p.text.id in :textIds")
    List<ReadingProgress> findForTexts(@Param("userId") Long userId, @Param("textIds") Collection<Long> textIds);

    /** Everyone's progress on one text. */
    @Query("select p from ReadingProgress p where p.text.id = :textId")
    List<ReadingProgress> findForText(@Param("textId") Long textId);

    @Modifying
    @Query("delete from ReadingProgress p where p.text.id = :textId")
    void deleteByTextId(@Param("textId") Long textId);
}
