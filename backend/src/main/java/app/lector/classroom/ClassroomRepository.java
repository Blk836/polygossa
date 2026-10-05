package app.lector.classroom;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    List<Classroom> findByTeacherIdOrderByCreatedAtDesc(Long teacherId);

    Optional<Classroom> findByJoinCodeIgnoreCase(String joinCode);

    boolean existsByJoinCode(String joinCode);
}
