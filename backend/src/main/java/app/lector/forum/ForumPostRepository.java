package app.lector.forum;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ForumPostRepository extends JpaRepository<ForumPost, Long> {

    @EntityGraph(attributePaths = "author")
    Page<ForumPost> findByThreadIdOrderByIdAsc(Long threadId, Pageable page);

    Optional<ForumPost> findFirstByThreadIdOrderByIdAsc(Long threadId);

    List<ForumPost> findByAuthorIdOrderByIdAsc(Long authorId);

    long countByAuthorId(Long authorId);

    long countByThreadIdAndAuthorId(Long threadId, Long authorId);

    @Modifying
    @Query("delete from ForumPost p where p.thread.id = :threadId")
    void deleteByThreadId(@Param("threadId") Long threadId);
}
