package app.lector.admin;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminActionRepository extends JpaRepository<AdminAction, Long> {

    List<AdminAction> findTop100ByOrderByIdDesc();
}
