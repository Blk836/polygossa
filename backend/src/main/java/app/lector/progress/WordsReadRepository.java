package app.lector.progress;

import app.lector.token.Language;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WordsReadRepository extends JpaRepository<WordsRead, Long> {

    @Modifying
    @Query(nativeQuery = true, value = "insert into words_read (user_id, language, day, words) "
            + "values (:userId, :language, :day, :words) on conflict (user_id, language, day) "
            + "do update set words = words_read.words + excluded.words")
    void addWords(@Param("userId") Long userId, @Param("language") String language, @Param("day") LocalDate day,
                  @Param("words") long words);

    interface DayWords {
        LocalDate getDay();
        long getWords();
    }

    @Query("select w.day as day, sum(w.words) as words from WordsRead w where w.userId = :userId and w.day >= :first "
            + "group by w.day")
    List<DayWords> perDaySince(@Param("userId") Long userId, @Param("first") LocalDate first);

    interface LanguageWords {
        Language getLanguage();
        long getWords();
    }

    @Query("select w.language as language, sum(w.words) as words from WordsRead w where w.userId = :userId "
            + "group by w.language")
    List<LanguageWords> totalsByLanguage(@Param("userId") Long userId);
}
