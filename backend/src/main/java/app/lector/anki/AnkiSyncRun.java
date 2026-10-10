package app.lector.anki;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;

@Entity
@Table(name = "anki_sync_runs")
public class AnkiSyncRun {

    public enum State { RUNNING, DONE, STOPPED }

    static final Duration QUIET_LIMIT = Duration.ofMinutes(2);

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    private boolean dryRun;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private State state = State.RUNNING;

    @Column(nullable = false)
    private Instant startedAt;

    @Column(nullable = false)
    private Instant lastActivityAt;

    private Instant finishedAt;

    private int cards;
    private int becameKnown;
    private int addedKnown;
    private int addedLearning;
    private int overLimit;
    private int skippedEmpty;
    private int skippedTooLong;
    private int skippedMedia;
    private int leaveReview;

    protected AnkiSyncRun() {}

    AnkiSyncRun(Long userId, boolean dryRun, Instant now) {
        this.userId = userId;
        this.dryRun = dryRun;
        this.startedAt = now;
        this.lastActivityAt = now;
    }

    boolean stopIfQuiet(Instant now) {
        if (state == State.RUNNING && now.isAfter(lastActivityAt.plus(QUIET_LIMIT))) {
            state = State.STOPPED;
            return true;
        }
        return false;
    }

    void stop(Instant now) {
        state = State.STOPPED;
        lastActivityAt = now;
    }

    void active(Instant now) {
        lastActivityAt = now;
    }

    void finish(Instant now) {
        state = State.DONE;
        finishedAt = now;
        lastActivityAt = now;
    }

    void card() {
        cards++;
    }

    void count(AnkiOutcome outcome) {
        switch (outcome) {
            case BECAME_KNOWN -> becameKnown++;
            case ADDED_KNOWN -> addedKnown++;
            case ADDED_LEARNING -> addedLearning++;
            case OVER_LIMIT -> overLimit++;
            case SKIPPED_EMPTY -> skippedEmpty++;
            case SKIPPED_TOO_LONG -> skippedTooLong++;
            case SKIPPED_MEDIA -> skippedMedia++;
            case LEAVE_REVIEW -> leaveReview++;
        }
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public boolean isDryRun() { return dryRun; }
    public State getState() { return state; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public int getCards() { return cards; }
    public int getBecameKnown() { return becameKnown; }
    public int getAddedKnown() { return addedKnown; }
    public int getAddedLearning() { return addedLearning; }
    public int getOverLimit() { return overLimit; }
    public int getSkippedEmpty() { return skippedEmpty; }
    public int getSkippedTooLong() { return skippedTooLong; }
    public int getSkippedMedia() { return skippedMedia; }
    public int getLeaveReview() { return leaveReview; }
}
