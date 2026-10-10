package app.lector.session;

import java.time.Instant;

public final class SessionTime {

    private final Instant startedAt;
    private final long durationSeconds;
    private final long listenedSeconds;

    public SessionTime(Instant startedAt, long durationSeconds, long listenedSeconds) {
        this.startedAt = startedAt;
        this.durationSeconds = durationSeconds;
        this.listenedSeconds = listenedSeconds;
    }

    public Instant getStartedAt() { return startedAt; }
    public long getDurationSeconds() { return durationSeconds; }
    public long getListenedSeconds() { return listenedSeconds; }
}
