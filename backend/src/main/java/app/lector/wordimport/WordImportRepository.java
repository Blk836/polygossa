package app.lector.wordimport;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WordImportRepository extends JpaRepository<WordImport, Long> {

    boolean existsByUserIdAndStateIn(Long userId, Collection<WordImport.State> states);

    List<WordImport> findByUserIdOrderByIdDesc(Long userId, Pageable page);

    Optional<WordImport> findByIdAndUserId(Long id, Long userId);

    List<WordImport> findByStateIn(Collection<WordImport.State> states);
}
