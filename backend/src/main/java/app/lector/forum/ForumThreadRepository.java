package app.lector.forum;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ForumThreadRepository extends JpaRepository<ForumThread, Long> {

    /** Threads in a category (every category when null), in the page's sort order. */
    @EntityGraph(attributePaths = "author")
    @Query("select t from ForumThread t where (:category is null or t.category = :category)")
    Page<ForumThread> list(@Param("category") ForumCategory category, Pageable page);
}
