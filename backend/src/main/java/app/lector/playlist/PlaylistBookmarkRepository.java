package app.lector.playlist;

import app.lector.token.Language;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlaylistBookmarkRepository extends JpaRepository<PlaylistBookmark, Long> {

    Optional<PlaylistBookmark> findByUserIdAndPlaylistId(Long userId, Long playlistId);

    @Query("""
            select p from PlaylistBookmark b join b.playlist p join fetch p.owner
            where b.user.id = :userId and p.language in :languages
              and (p.isPublic = true or p.owner.id = :userId)
            order by b.createdAt desc, b.id desc
            """)
    List<Playlist> findSaved(@Param("userId") Long userId, @Param("languages") Collection<Language> languages);

    @Query("select b.playlist.id from PlaylistBookmark b where b.user.id = :userId and b.playlist.id in :playlistIds")
    List<Long> savedAmong(@Param("userId") Long userId, @Param("playlistIds") Collection<Long> playlistIds);

    @Modifying
    @Query("delete from PlaylistBookmark b where b.playlist.id = :playlistId")
    void deleteByPlaylistId(@Param("playlistId") Long playlistId);
}
