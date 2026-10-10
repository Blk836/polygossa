package app.lector.srs;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.time.Instant;

@Embeddable
public class SrsState {

    @Column(nullable = false)
    private double easeFactor = 2.5;

    @Column(nullable = false)
    private double intervalDays = 0;

    @Column(nullable = false)
    private int repetitions = 0;

    @Column(nullable = false)
    private int lapses = 0;

    private Instant dueAt = Instant.now();

    private Instant lastReviewedAt;

    public double getEaseFactor() { return easeFactor; }
    public void setEaseFactor(double easeFactor) { this.easeFactor = easeFactor; }
    public double getIntervalDays() { return intervalDays; }
    public void setIntervalDays(double intervalDays) { this.intervalDays = intervalDays; }
    public int getRepetitions() { return repetitions; }
    public void setRepetitions(int repetitions) { this.repetitions = repetitions; }
    public int getLapses() { return lapses; }
    public void setLapses(int lapses) { this.lapses = lapses; }
    public Instant getDueAt() { return dueAt; }
    public void setDueAt(Instant dueAt) { this.dueAt = dueAt; }
    public Instant getLastReviewedAt() { return lastReviewedAt; }
    public void setLastReviewedAt(Instant lastReviewedAt) { this.lastReviewedAt = lastReviewedAt; }
}
