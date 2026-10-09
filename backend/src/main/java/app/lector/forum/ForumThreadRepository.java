package app.lector.forum;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ForumThreadRepository extends JpaRepository<ForumThread, Long> {

    List<ForumThread> findByAuthorId(Long authorId);

    @EntityGraph(attributePaths = "author")
    @Query("select t from ForumThread t where (:category is null or t.category = :category)")
    Page<ForumThread> list(@Param("category") ForumCategory category, Pageable page);
}
