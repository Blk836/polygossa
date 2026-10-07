package app.lector.user;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    /** Users whose email or name contains {@code q} (a lower-cased LIKE pattern, or null for everyone). */
    @Query("select u from User u where :q is null or lower(u.email) like :q or lower(u.displayName) like :q")
    Page<User> search(@Param("q") String q, Pageable pageable);
}
