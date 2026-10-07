package app.lector.forum;

import app.lector.common.ApiException;
import app.lector.forum.ForumDtos.Post;
import app.lector.forum.ForumDtos.ThreadList;
import app.lector.forum.ForumDtos.ThreadPage;
import app.lector.forum.ForumDtos.ThreadSummary;
import app.lector.user.User;
import java.time.Clock;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The forum: threads in fixed categories, plain-text posts in order. Authors edit and delete their own posts
 * (deleting a thread's first post deletes the thread); admins start announcements, pin, lock and delete anything.
 */
@Service
public class ForumService {

    static final int THREADS_PER_PAGE = 20;
    static final int POSTS_PER_PAGE = 50;
    static final int TITLE_MIN = 3;
    static final int TITLE_MAX = 120;
    static final int BODY_MAX = 10_000;

    private static final Sort THREAD_ORDER = Sort.by(Sort.Order.desc("pinned"), Sort.Order.desc("lastPostAt"),
            Sort.Order.desc("id"));

    private final ForumThreadRepository threads;
    private final ForumPostRepository posts;
    private final ForumProperties props;
    private final Clock clock;

    public ForumService(ForumThreadRepository threads, ForumPostRepository posts, ForumProperties props, Clock clock) {
        this.threads = threads;
        this.posts = posts;
        this.props = props;
        this.clock = clock;
    }

    public boolean isAdmin(User user) {
        return props.isAdmin(user.getEmail());
    }

    @Transactional(readOnly = true)
    public ThreadList list(User viewer, String category, int page) {
        ForumCategory only = category == null || category.isBlank() ? null : ForumCategory.parse(category);
        Page<ForumThread> found = threads.list(only, PageRequest.of(checkPage(page), THREADS_PER_PAGE, THREAD_ORDER));
        return new ThreadList(found.map(ThreadSummary::of).toList(), found.getTotalElements(), page, THREADS_PER_PAGE,
                isAdmin(viewer));
    }

    @Transactional
    public ThreadSummary start(User author, String category, String title, String body) {
        if (category == null) {
            throw ApiException.badRequest("Choose a category");
        }
        ForumCategory c = ForumCategory.parse(category);
        String t = text(title, TITLE_MIN, TITLE_MAX, "The title");
        String b = text(body, 1, BODY_MAX, "The message");
        if (c == ForumCategory.ANNOUNCEMENTS && !isAdmin(author)) {
            throw ApiException.forbidden("Only the team posts announcements");
        }
        Instant now = clock.instant();
        ForumThread thread = threads.save(new ForumThread(c, t, author, now));
        posts.save(new ForumPost(thread, author, b, now));
        return ThreadSummary.of(thread);
    }

    @Transactional(readOnly = true)
    public ThreadPage show(User viewer, Long threadId, int page) {
        ForumThread thread = thread(threadId);
        Page<ForumPost> found = posts.findByThreadIdOrderByIdAsc(threadId, PageRequest.of(checkPage(page), POSTS_PER_PAGE));
        return new ThreadPage(ThreadSummary.of(thread), found.map(p -> Post.of(p, viewer)).toList(),
                found.getTotalElements(), page, POSTS_PER_PAGE, isAdmin(viewer));
    }

    @Transactional
    public Post reply(User author, Long threadId, String body) {
        ForumThread thread = thread(threadId);
        String b = text(body, 1, BODY_MAX, "The message");
        if (thread.isLocked()) {
            throw ApiException.conflict("This thread is locked: no new replies");
        }
        Instant now = clock.instant();
        thread.replied(now);
        return Post.of(posts.save(new ForumPost(thread, author, b, now)), author);
    }

    /** Only the author edits a post, admins included. */
    @Transactional
    public Post edit(User user, Long postId, String body) {
        ForumPost post = post(postId);
        if (!post.getAuthor().getId().equals(user.getId())) {
            throw ApiException.forbidden("You can only edit your own posts");
        }
        post.edit(text(body, 1, BODY_MAX, "The message"), clock.instant());
        return Post.of(post, user);
    }

    @Transactional
    public void delete(User user, Long postId) {
        ForumPost post = post(postId);
        if (!post.getAuthor().getId().equals(user.getId()) && !isAdmin(user)) {
            throw ApiException.forbidden("You can only delete your own posts");
        }
        ForumThread thread = post.getThread();
        boolean opening = posts.findFirstByThreadIdOrderByIdAsc(thread.getId())
                .map(first -> first.getId().equals(postId)).orElse(false);
        if (opening) {
            posts.deleteByThreadId(thread.getId());
            threads.delete(thread);
        } else {
            posts.delete(post);
            thread.replyDeleted();
        }
    }

    /** What removing someone's posts took away. */
    public record Removed(int posts, int threads) {}

    /**
     * Removes every post by {@code author} (admin moderation): threads they started go with all their replies, as
     * deleting a thread's first post does; their replies elsewhere go alone.
     */
    @Transactional
    public Removed removeAllBy(User author) {
        int removedPosts = 0;
        int removedThreads = 0;
        for (ForumThread thread : threads.findByAuthorId(author.getId())) {
            removedPosts += (int) posts.countByThreadIdAndAuthorId(thread.getId(), author.getId());
            posts.deleteByThreadId(thread.getId());
            threads.delete(thread);
            removedThreads++;
        }
        for (ForumPost post : posts.findByAuthorIdOrderByIdAsc(author.getId())) {
            post.getThread().replyDeleted();
            posts.delete(post);
            removedPosts++;
        }
        return new Removed(removedPosts, removedThreads);
    }

    /** Pins or locks a thread (null leaves that alone); admins only. */
    @Transactional
    public ThreadSummary moderate(User user, Long threadId, Boolean pinned, Boolean locked) {
        if (!isAdmin(user)) {
            throw ApiException.forbidden("Only the team pins and locks threads");
        }
        ForumThread thread = thread(threadId);
        if (pinned != null) {
            thread.setPinned(pinned);
        }
        if (locked != null) {
            thread.setLocked(locked);
        }
        return ThreadSummary.of(thread);
    }

    private ForumThread thread(Long id) {
        return threads.findById(id).orElseThrow(() -> ApiException.notFound("Thread"));
    }

    private ForumPost post(Long id) {
        return posts.findById(id).orElseThrow(() -> ApiException.notFound("Post"));
    }

    private static int checkPage(int page) {
        if (page < 0) {
            throw ApiException.badRequest("page must be 0 or more");
        }
        return page;
    }

    /** Stripped of surrounding blank space, and between {@code min} and {@code max} characters. */
    private static String text(String value, int min, int max, String what) {
        String s = value == null ? "" : value.strip();
        if (s.length() < min || s.length() > max) {
            throw ApiException.badRequest(what + " must be " + min + " to " + max + " characters");
        }
        return s;
    }
}
