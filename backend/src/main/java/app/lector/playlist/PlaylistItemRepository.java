package app.lector.playlist;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlaylistItemRepository extends JpaRepository<PlaylistItem, Long> {

    @Query("""
            select i from PlaylistItem i join fetch i.text t join fetch t.owner
            where i.playlist.id in :playlistIds order by i.position, i.id
            """)
    List<PlaylistItem> findForPlaylists(@Param("playlistIds") Collection<Long> playlistIds);

    @Query("select i from PlaylistItem i where i.playlist.id = :playlistId and i.text.id = :textId")
    Optional<PlaylistItem> findOne(@Param("playlistId") Long playlistId, @Param("textId") Long textId);

    long countByPlaylistId(Long playlistId);

    @Query("select coalesce(max(i.position), -1) from PlaylistItem i where i.playlist.id = :playlistId")
    int lastPosition(@Param("playlistId") Long playlistId);

    @Modifying
    @Query("delete from PlaylistItem i where i.text.id = :textId")
    void deleteByTextId(@Param("textId") Long textId);

    @Modifying
    @Query("delete from PlaylistItem i where i.playlist.id = :playlistId")
    void deleteByPlaylistId(@Param("playlistId") Long playlistId);
}
