package app.lector.user;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.ZoneId;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Tier tier = Tier.FREE;

    /** Language chosen during onboarding; the default for library, review and dashboard filters. */
    @Enumerated(EnumType.STRING)
    private Language targetLanguage;

    /** The language definitions are translated into; English (the dictionaries' own language) by default. */
    @Enumerated(EnumType.STRING)
    private NativeLanguage nativeLanguage = NativeLanguage.EN;

    @Column(nullable = false)
    private int dailyReviewGoal = 20;

    /** What the daily goal measures; null (accounts from before goals) means reviews, with dailyReviewGoal. */
    @Enumerated(EnumType.STRING)
    private GoalKind dailyGoalKind;

    /** The target for a goal other than reviews (whose target is dailyReviewGoal). */
    private Integer dailyGoalTarget;

    /** Opt-in: only days that reach the daily goal count toward the streak. Null means off. */
    private Boolean streakNeedsGoal;

    /** IANA zone used to decide what "today" means for review goals and streaks. */
    @Column(nullable = false)
    private String timezone = "UTC";

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    /** Stored name of the profile photo (see {@code StorageService}), or null for none. */
    private String photoFile;

    protected User() {}

    public User(String email, String passwordHash, String displayName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public Tier getTier() {
        return tier;
    }

    public void setTier(Tier tier) {
        this.tier = tier;
    }

    public Language getTargetLanguage() {
        return targetLanguage;
    }

    public void setTargetLanguage(Language targetLanguage) {
        this.targetLanguage = targetLanguage;
    }

    /** Accounts from before the setting existed read as English. */
    public NativeLanguage getNativeLanguage() {
        return nativeLanguage == null ? NativeLanguage.EN : nativeLanguage;
    }

    public void setNativeLanguage(NativeLanguage nativeLanguage) {
        this.nativeLanguage = nativeLanguage;
    }

    public DailyGoal getDailyGoal() {
        if (dailyGoalKind == null || dailyGoalKind == GoalKind.REVIEWS || dailyGoalTarget == null) {
            return new DailyGoal(GoalKind.REVIEWS, dailyReviewGoal);
        }
        return new DailyGoal(dailyGoalKind, dailyGoalTarget);
    }

    /** A reviews goal is the review goal Review uses; other kinds keep their own target. */
    public void setDailyGoal(DailyGoal goal) {
        dailyGoalKind = goal.kind();
        if (goal.kind() == GoalKind.REVIEWS) {
            dailyReviewGoal = goal.target();
            dailyGoalTarget = null;
        } else {
            dailyGoalTarget = goal.target();
        }
    }

    public boolean isStreakNeedsGoal() {
        return Boolean.TRUE.equals(streakNeedsGoal);
    }

    public void setStreakNeedsGoal(boolean streakNeedsGoal) {
        this.streakNeedsGoal = streakNeedsGoal;
    }

    public int getDailyReviewGoal() {
        return dailyReviewGoal;
    }

    public void setDailyReviewGoal(int dailyReviewGoal) {
        this.dailyReviewGoal = dailyReviewGoal;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public ZoneId zone() {
        try {
            return ZoneId.of(timezone);
        } catch (Exception e) {
            return ZoneId.of("UTC");
        }
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getPhotoFile() {
        return photoFile;
    }

    public void setPhotoFile(String photoFile) {
        this.photoFile = photoFile;
    }

    /**
     * Where the profile photo is served, or null for none. The stored name changes with every upload, so it doubles
     * as a cache-busting version and the photo can be cached for good.
     */
    public String photoUrl() {
        return photoFile == null ? null : "/api/users/" + id + "/photo?v=" + photoFile;
    }
}
