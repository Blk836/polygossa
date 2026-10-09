package app.lector.progress;

import app.lector.token.Language;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WordsReadRepository extends JpaRepository<WordsRead, Long> {

    Optional<WordsRead> findByUserIdAndLanguageAndDay(Long userId, Language language, LocalDate day);

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
