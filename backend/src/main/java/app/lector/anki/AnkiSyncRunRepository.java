package app.lector.anki;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnkiSyncRunRepository extends JpaRepository<AnkiSyncRun, Long> {

    Optional<AnkiSyncRun> findByIdAndUserId(Long id, Long userId);

    List<AnkiSyncRun> findByUserIdAndState(Long userId, AnkiSyncRun.State state);

    Optional<AnkiSyncRun> findFirstByUserIdAndDryRunFalseOrderByIdDesc(Long userId);

    @Modifying
    @Query("delete from AnkiSyncRun r where r.userId = :user and (:keep is null or r.id <> :keep)")
    void deleteAllBut(@Param("user") Long user, @Param("keep") Long keep);

    @Query("select w.term from AnkiSyncRunWord w where w.runId = :run and w.outcome = :outcome order by w.id")
    List<String> findTerms(@Param("run") Long run, @Param("outcome") AnkiOutcome outcome);
}
