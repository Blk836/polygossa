package app.lector.forum;

import app.lector.user.User;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/** What the forum API returns. */
public final class ForumDtos {

    private ForumDtos() {}

    public record Author(Long id, String name) {
        static Author of(User u) {
            return new Author(u.getId(), u.getDisplayName());
        }
    }

    public record ThreadSummary(Long id, ForumCategory category, String title, Author author, Instant createdAt,
                                Instant lastPostAt, int replies, boolean pinned, boolean locked) {
        static ThreadSummary of(ForumThread t) {
            return new ThreadSummary(t.getId(), t.getCategory(), t.getTitle(), Author.of(t.getAuthor()),
                    t.getCreatedAt(), t.getLastPostAt(), t.getReplyCount(), t.isPinned(), t.isLocked());
        }
    }

    public record ThreadList(List<ThreadSummary> threads, long total, int page, int size, boolean canModerate) {}

    /** {@code mine}: the viewer wrote it, so may edit it. */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Post(Long id, Author author, String body, Instant createdAt, Instant editedAt, boolean mine) {
        static Post of(ForumPost p, User viewer) {
            return new Post(p.getId(), Author.of(p.getAuthor()), p.getBody(), p.getCreatedAt(), p.getEditedAt(),
                    p.getAuthor().getId().equals(viewer.getId()));
        }
    }

    public record ThreadPage(ThreadSummary thread, List<Post> posts, long total, int page, int size,
                             boolean canModerate) {}
}
