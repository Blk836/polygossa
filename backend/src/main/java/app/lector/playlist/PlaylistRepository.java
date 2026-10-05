package app.lector.playlist;

import app.lector.token.Language;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlaylistRepository extends JpaRepository<Playlist, Long> {

    /** The user's playlists, in one language or (null) all, newest first. */
    @Query("""
            select p from Playlist p join fetch p.owner
            where p.owner.id = :ownerId and (:language is null or p.language = :language)
            order by p.createdAt desc, p.id desc
            """)
    List<Playlist> findMine(@Param("ownerId") Long ownerId, @Param("language") Language language);

    /** Shared playlists, most recently changed first. {@code q} must be a lower-cased LIKE pattern or null. */
    @Query("""
            select p from Playlist p join fetch p.owner
            where p.isPublic = true and (:language is null or p.language = :language)
              and (:q is null or lower(p.title) like :q)
            order by p.updatedAt desc, p.id desc
            """)
    List<Playlist> findShared(@Param("language") Language language, @Param("q") String q, Pageable pageable);
}
