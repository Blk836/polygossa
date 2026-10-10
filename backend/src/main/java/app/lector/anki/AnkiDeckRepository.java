package app.lector.anki;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnkiDeckRepository extends JpaRepository<AnkiDeck, Long> {

    List<AnkiDeck> findByUserIdOrderById(Long userId);

    Optional<AnkiDeck> findByUserIdAndAnkiDeckId(Long userId, long ankiDeckId);
}
