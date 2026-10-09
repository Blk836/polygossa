package app.lector.playlist;

import app.lector.token.Language;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlaylistRepository extends JpaRepository<Playlist, Long> {

    long countByOwnerId(Long ownerId);

    List<Playlist> findByOwnerIdAndLanguageAndTitle(Long ownerId, Language language, String title);

    @Query("""
            select p from Playlist p join fetch p.owner
            where p.owner.id = :ownerId and p.language in :languages
            order by p.createdAt desc, p.id desc
            """)
    List<Playlist> findMine(@Param("ownerId") Long ownerId, @Param("languages") Collection<Language> languages);

    @Query("""
            select p from Playlist p join fetch p.owner
            where p.isPublic = true and p.language in :languages
              and (:q is null or lower(p.title) like :q)
            order by p.updatedAt desc, p.id desc
            """)
    List<Playlist> findShared(@Param("languages") Collection<Language> languages, @Param("q") String q, Pageable pageable);
}
