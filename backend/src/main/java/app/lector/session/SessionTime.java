package app.lector.session;

import java.time.Instant;

/**
 * When a reading session started and how long it ran, as the streak and Progress figures read them for every
 * session in a period. A plain row built by the query rather than a per-row interface-projection proxy.
 */
public final class SessionTime {

    private final Instant startedAt;
    private final long durationSeconds;

    public SessionTime(Instant startedAt, long durationSeconds) {
        this.startedAt = startedAt;
        this.durationSeconds = durationSeconds;
    }

    public Instant getStartedAt() { return startedAt; }
    public long getDurationSeconds() { return durationSeconds; }
}
